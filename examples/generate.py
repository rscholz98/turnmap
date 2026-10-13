"""Generate the example message histories shipped with turnmap.

Every file is produced by pydantic-ai itself (FunctionModel / TestModel) and
written with `all_messages_json()`, so the fixtures track the real schema.

Run from the repo root with a pydantic-ai environment available, for example:

    uv run --project ../pydantic-ai python examples/generate.py
"""

from __future__ import annotations

import base64
import json
import sys
from pathlib import Path

from pydantic import BaseModel, Field

from pydantic_ai import Agent, BinaryContent, ImageUrl, ModelRetry, RunContext
from pydantic_ai.messages import (
    ModelMessage,
    ModelRequest,
    ModelResponse,
    NativeToolCallPart,
    NativeToolReturnPart,
    RetryPromptPart,
    TextPart,
    ThinkingPart,
    ToolCallPart,
    ToolReturnPart,
)
from pydantic_ai.models.function import AgentInfo, FunctionModel
from pydantic_ai.models.test import TestModel
from pydantic_ai.usage import RequestUsage

OUT = Path(__file__).parent


class Booking(BaseModel):
    date: str = Field(description='ISO date')
    guests: int = Field(ge=1, le=12)
    name: str

# 1x1 transparent PNG
TINY_PNG = base64.b64decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
)


def write(name: str, data: bytes) -> None:
    path = OUT / f'{name}.json'
    parsed = json.loads(data)
    path.write_text(json.dumps(parsed, indent=2, ensure_ascii=False) + '\n')
    print(f'wrote {path.name}: {len(parsed)} messages')


def last_user_text(messages: list[ModelMessage]) -> str:
    for message in reversed(messages):
        if isinstance(message, ModelRequest):
            for part in message.parts:
                if part.part_kind == 'user-prompt' and isinstance(part.content, str):
                    return part.content
    return ''


def usage(i: int, o: int) -> RequestUsage:
    return RequestUsage(input_tokens=i, output_tokens=o)


# ---------------------------------------------------------------------------
# 1. simple-chat: system prompt, user prompt, text answer, two turns
# ---------------------------------------------------------------------------
def simple_chat() -> None:
    agent = Agent(
        TestModel(custom_output_text='Hi! I am a support assistant for Acme Grills. How can I help?'),
        system_prompt='You are the friendly support assistant for Acme Grills. Answer briefly.',
    )
    result = agent.run_sync('Hello, who are you?')
    agent2 = Agent(
        TestModel(custom_output_text='The Acme 500 ships in 2 to 3 business days within the EU.'),
        system_prompt='You are the friendly support assistant for Acme Grills. Answer briefly.',
    )
    result2 = agent2.run_sync('How long does shipping take for the Acme 500?', message_history=result.all_messages())
    write('simple-chat', result2.all_messages_json())


# ---------------------------------------------------------------------------
# 2. tool-calls: parallel tool calls, returns, final answer, second turn
# ---------------------------------------------------------------------------
def tool_calls() -> None:
    def model(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        last = messages[-1]
        if isinstance(last, ModelRequest) and any(p.part_kind == 'tool-return' for p in last.parts):
            returns = {p.tool_name: p.content for p in last.parts if p.part_kind == 'tool-return'}
            if 'get_stock' in returns:
                return ModelResponse(
                    parts=[TextPart('The Acme 500 is in stock (12 units) and ships in 2 days.')],
                    usage=usage(640, 28),
                    model_name='demo-model-1',
                    finish_reason='stop',
                )
            return ModelResponse(
                parts=[TextPart('Your order #A-1042 shipped on Monday with DHL and should arrive tomorrow. The weather at the destination is sunny, 24 C.')],
                usage=usage(512, 41),
                model_name='demo-model-1',
                finish_reason='stop',
            )
        text = last_user_text(messages)
        if 'stock' in text:
            return ModelResponse(
                parts=[ToolCallPart('get_stock', {'sku': 'ACME-500'}, tool_call_id='call_stock_1')],
                usage=usage(590, 18),
                model_name='demo-model-1',
                finish_reason='tool_call',
            )
        return ModelResponse(
            parts=[
                ToolCallPart('get_order', {'order_id': 'A-1042'}, tool_call_id='call_order_1'),
                ToolCallPart('get_weather', {'city': 'Berlin', 'unit': 'celsius'}, tool_call_id='call_weather_1'),
            ],
            usage=usage(402, 36),
            model_name='demo-model-1',
            finish_reason='tool_call',
        )

    agent = Agent(FunctionModel(model, model_name='demo-model-1'), system_prompt='You are an order assistant. Use tools to look things up.')

    @agent.tool_plain
    def get_order(order_id: str) -> dict[str, object]:
        """Look up an order by id."""
        return {
            'order_id': order_id,
            'status': 'shipped',
            'carrier': 'DHL',
            'shipped_at': '2026-10-12',
            'items': [
                {'sku': 'ACME-500', 'name': 'Acme 500 Gas Grill', 'qty': 1, 'price': 499.0},
                {'sku': 'COVER-500', 'name': 'Weather cover', 'qty': 1, 'price': 39.9},
            ],
            'address': {'city': 'Berlin', 'country': 'DE'},
        }

    @agent.tool_plain
    def get_weather(city: str, unit: str = 'celsius') -> dict[str, object]:
        """Current weather for a city."""
        return {'city': city, 'temperature': 24, 'unit': unit, 'condition': 'sunny'}

    @agent.tool_plain
    def get_stock(sku: str) -> dict[str, object]:
        """Stock level for a SKU."""
        return {'sku': sku, 'available': 12, 'warehouse': 'Hamburg', 'lead_time_days': 2}

    first = agent.run_sync('Where is my order A-1042 and what is the weather like there?')
    second = agent.run_sync('Is the Acme 500 still in stock?', message_history=first.all_messages())
    write('tool-calls', second.all_messages_json())


# ---------------------------------------------------------------------------
# 3. retry: invalid tool args (validation retry), then an output validator retry
# ---------------------------------------------------------------------------
def retry() -> None:
    attempts = {'tool': 0, 'answer': 0}

    def model(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        last = messages[-1]
        if isinstance(last, ModelRequest):
            kinds = [p.part_kind for p in last.parts]
            if 'retry-prompt' in kinds:
                retry_part = next(p for p in last.parts if p.part_kind == 'retry-prompt')
                assert isinstance(retry_part, RetryPromptPart)
                if retry_part.tool_name == 'book_table':
                    return ModelResponse(
                        parts=[ToolCallPart('book_table', {'date': '2026-10-20', 'guests': 4, 'name': 'Scholz'}, tool_call_id='call_book_2')],
                        usage=usage(730, 40),
                        model_name='demo-model-1',
                        finish_reason='tool_call',
                    )
                return ModelResponse(
                    parts=[TextPart('Your table for 4 is booked for 2026-10-20 under the name Scholz. Confirmation: RSV-7781.')],
                    usage=usage(880, 33),
                    model_name='demo-model-1',
                    finish_reason='stop',
                )
            if 'tool-return' in kinds:
                attempts['answer'] += 1
                return ModelResponse(
                    parts=[TextPart('Done, your table is booked.')],
                    usage=usage(810, 9),
                    model_name='demo-model-1',
                    finish_reason='stop',
                )
        attempts['tool'] += 1
        return ModelResponse(
            parts=[ToolCallPart('book_table', {'date': 'next tuesday', 'guests': 40}, tool_call_id='call_book_1')],
            usage=usage(610, 31),
            model_name='demo-model-1',
            finish_reason='tool_call',
        )

    agent = Agent(FunctionModel(model, model_name='demo-model-1'), system_prompt='You book restaurant tables.', retries=3)

    @agent.tool
    def book_table(ctx: RunContext[None], booking: Booking) -> dict[str, object]:
        """Book a table."""
        return {'confirmation': 'RSV-7781', 'booking': booking.model_dump()}

    @agent.output_validator
    def must_mention_confirmation(ctx: RunContext[None], output: str) -> str:
        if 'RSV-' not in output:
            raise ModelRetry('Always include the confirmation number (it starts with RSV-) in the final answer.')
        return output

    result = agent.run_sync('Book a table for 4 next Tuesday under Scholz.')
    write('retry', result.all_messages_json())


# ---------------------------------------------------------------------------
# 4. multimodal: image url + inline binary in the user prompt, thinking part
# ---------------------------------------------------------------------------
def multimodal() -> None:
    def model(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        return ModelResponse(
            parts=[
                ThinkingPart('The user attached a product photo and a small icon. The photo shows a gas grill with a rusted burner, so the likely answer is a replacement burner.'),
                TextPart('That looks like a corroded burner tube. For the Acme 500 the replacement part is BRN-500 (29.90 EUR). Want me to add it to your cart?'),
            ],
            usage=usage(1860, 96),
            model_name='demo-vision-1',
            finish_reason='stop',
        )

    agent = Agent(FunctionModel(model, model_name='demo-vision-1'), system_prompt='You are a product support assistant. You can see images.')
    result = agent.run_sync(
        [
            'My grill is not heating evenly. What is wrong with this part?',
            ImageUrl(url='https://example.com/uploads/grill-burner.jpg'),
            BinaryContent(data=TINY_PNG, media_type='image/png'),
        ]
    )
    write('multimodal', result.all_messages_json())


# ---------------------------------------------------------------------------
# 5. builtin-tools: a provider-executed web search inside the response
# ---------------------------------------------------------------------------
def builtin_tools() -> None:
    def model(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        return ModelResponse(
            parts=[
                NativeToolCallPart(
                    tool_name='web_search',
                    args={'query': 'Acme 500 grill review 2026'},
                    tool_call_id='srv_ws_1',
                    provider_name='openai',
                ),
                NativeToolReturnPart(
                    tool_name='web_search',
                    content={
                        'results': [
                            {'title': 'Acme 500 review: solid mid-range grill', 'url': 'https://example.com/reviews/acme-500', 'snippet': 'Even heat, sturdy build, burners rated 4.5/5.'},
                            {'title': 'Best gas grills 2026', 'url': 'https://example.com/best-gas-grills', 'snippet': 'The Acme 500 lands in our top five.'},
                        ]
                    },
                    tool_call_id='srv_ws_1',
                    provider_name='openai',
                ),
                TextPart('Reviews are positive: even heat and sturdy build, with the Acme 500 in several 2026 top-five lists.'),
            ],
            usage=usage(950, 120),
            model_name='demo-search-1',
            provider_name='openai',
            finish_reason='stop',
        )

    agent = Agent(FunctionModel(model, model_name='demo-search-1'))
    result = agent.run_sync('What do reviewers say about the Acme 500?')
    write('builtin-tools', result.all_messages_json())


if __name__ == '__main__':
    simple_chat()
    tool_calls()
    retry()
    multimodal()
    builtin_tools()
    sys.exit(0)
