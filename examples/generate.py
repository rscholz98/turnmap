"""Generate the example message histories shipped with turnmap.

Every file is produced by pydantic-ai itself (FunctionModel / TestModel), so the
fixtures track the real schema. Most are written with `all_messages_json()`;
`paused-conversation` is a `Conversation` dumped with `ConversationTypeAdapter`,
and `stored-conversation` is the record and entries a `ConversationStore` keeps.
`deltas` is a test fixture written to `packages/turnmap/test/fixtures`.

Run from the repo root with a pydantic-ai environment available, for example:

    uv run --project ../pydantic-ai python examples/generate.py
    uv run --project ../pydantic-ai python examples/generate.py stored-conversation
"""

from __future__ import annotations

import asyncio
import base64
import json
import sys
from pathlib import Path

from pydantic import BaseModel, Field, TypeAdapter

from pydantic_ai import (
    Agent,
    BinaryContent,
    CallDeferred,
    Conversation,
    ConversationTypeAdapter,
    DeferredToolRequests,
    DeferredToolResults,
    ImageUrl,
    ModelRetry,
    RunContext,
    ToolDenied,
)
from pydantic_ai.conversation_store import ConversationEntry, ConversationRecord, InMemoryConversationStore
from pydantic_ai.messages import (
    CapabilityLoadDeltaPart,
    InstructionBaselinePart,
    InstructionDeltaPart,
    InstructionDigest,
    InstructionPart,
    ModelMessage,
    ModelMessagesTypeAdapter,
    ModelRequest,
    ModelResponse,
    ModelSettingsDeltaPart,
    NativeToolCallPart,
    NativeToolReturnPart,
    TextPart,
    ThinkingPart,
    ToolCallPart,
    ToolReturnPart,
    UserPromptPart,
)
from pydantic_ai.models.function import AgentInfo, FunctionModel
from pydantic_ai.models.test import TestModel
from pydantic_ai.usage import RequestUsage

OUT = Path(__file__).parent
# Histories only the tests read, not shown as examples on the site.
TEST_FIXTURES = OUT.parent / 'packages' / 'turnmap' / 'test' / 'fixtures'


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
    if isinstance(parsed, list):
        print(f'wrote {path.name}: {len(parsed)} messages')
    elif 'entries' in parsed:
        print(f'wrote {path.name}: {len(parsed["entries"])} entries')
    else:
        print(f'wrote {path.name}: {len(parsed["messages"])} messages')


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
            # A tool call to make again comes back as a tool return with outcome 'retried'.
            # An output the validator rejected is stored as retry feedback, which the model
            # is sent in the user voice: a user prompt after the first answer.
            if any(isinstance(p, ToolReturnPart) and p.outcome == 'retried' for p in last.parts):
                return ModelResponse(
                    parts=[ToolCallPart('book_table', {'date': '2026-10-20', 'guests': 4, 'name': 'Scholz'}, tool_call_id='call_book_2')],
                    usage=usage(730, 40),
                    model_name='demo-model-1',
                    finish_reason='tool_call',
                )
            if attempts['answer'] and 'user-prompt' in kinds:
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

    agent = Agent(FunctionModel(model, model_name='demo-search-1'), system_prompt='You are a shopping assistant. Search the web when asked about reviews.')
    result = agent.run_sync('What do reviewers say about the Acme 500?')
    write('builtin-tools', result.all_messages_json())


# ---------------------------------------------------------------------------
# 6. structured-output: output_type=Invoice, delivered through the final_result tool
# ---------------------------------------------------------------------------
class InvoiceLine(BaseModel):
    sku: str
    description: str
    qty: int
    unit_price: float


class Invoice(BaseModel):
    invoice_number: str
    customer: str
    lines: list[InvoiceLine]
    total: float


def structured_output() -> None:
    def model(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        last = messages[-1]
        if isinstance(last, ModelRequest) and any(p.part_kind == 'tool-return' and p.tool_name == 'lookup_order' for p in last.parts):
            return ModelResponse(
                parts=[
                    ToolCallPart(
                        'final_result',
                        {
                            'invoice_number': 'INV-2026-0419',
                            'customer': 'Scholz',
                            'lines': [
                                {'sku': 'ACME-500', 'description': 'Acme 500 Gas Grill', 'qty': 1, 'unit_price': 499.0},
                                {'sku': 'COVER-500', 'description': 'Weather cover', 'qty': 1, 'unit_price': 39.9},
                            ],
                            'total': 538.9,
                        },
                        tool_call_id='call_final_1',
                    )
                ],
                usage=usage(720, 88),
                model_name='demo-model-1',
                finish_reason='tool_call',
            )
        return ModelResponse(
            parts=[ToolCallPart('lookup_order', {'order_id': 'A-1042'}, tool_call_id='call_lookup_1')],
            usage=usage(410, 19),
            model_name='demo-model-1',
            finish_reason='tool_call',
        )

    agent = Agent(
        FunctionModel(model, model_name='demo-model-1'),
        system_prompt='You turn orders into invoices. Return structured data only.',
        output_type=Invoice,
    )

    @agent.tool_plain
    def lookup_order(order_id: str) -> dict[str, object]:
        """Fetch an order."""
        return {
            'order_id': order_id,
            'customer': 'Scholz',
            'items': [
                {'sku': 'ACME-500', 'name': 'Acme 500 Gas Grill', 'qty': 1, 'price': 499.0},
                {'sku': 'COVER-500', 'name': 'Weather cover', 'qty': 1, 'price': 39.9},
            ],
        }

    result = agent.run_sync('Create the invoice for order A-1042.')
    assert isinstance(result.output, Invoice)
    write('structured-output', result.all_messages_json())


# ---------------------------------------------------------------------------
# 7. approvals: human-in-the-loop, one call approved and one denied
# ---------------------------------------------------------------------------
def approvals() -> None:
    def model(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        last = messages[-1]
        if isinstance(last, ModelRequest) and any(p.part_kind == 'tool-return' for p in last.parts):
            return ModelResponse(
                parts=[
                    TextPart(
                        'Done: README.md was updated. I did not delete .env because that call was denied, so it is still in place.'
                    )
                ],
                usage=usage(690, 44),
                model_name='demo-model-1',
                finish_reason='stop',
            )
        return ModelResponse(
            parts=[
                ToolCallPart('read_file', {'path': 'README.md'}, tool_call_id='call_read_1'),
                ToolCallPart('update_file', {'path': 'README.md', 'content': '# Acme\n\nHello, world!'}, tool_call_id='call_update_1'),
                ToolCallPart('delete_file', {'path': '.env'}, tool_call_id='call_delete_1'),
            ],
            usage=usage(450, 72),
            model_name='demo-model-1',
            finish_reason='tool_call',
        )

    agent = Agent(
        FunctionModel(model, model_name='demo-model-1'),
        system_prompt='You are a repository assistant. Destructive changes need approval.',
        output_type=[str, DeferredToolRequests],
    )

    @agent.tool_plain
    def read_file(path: str) -> str:
        """Read a file."""
        return '# Acme\n\nOld readme.'

    @agent.tool_plain(requires_approval=True)
    def update_file(path: str, content: str) -> str:
        """Write a file. Needs approval."""
        return f'File {path!r} updated ({len(content)} chars)'

    @agent.tool_plain(requires_approval=True)
    def delete_file(path: str) -> str:
        """Delete a file. Needs approval."""
        return f'File {path!r} deleted'

    first = agent.run_sync('Update README.md with a hello world and delete .env.')
    requests = first.output
    assert isinstance(requests, DeferredToolRequests)
    decisions: dict[str, object] = {}
    for call in requests.approvals:
        decisions[call.tool_call_id] = (
            True if call.tool_name == 'update_file' else ToolDenied('Deleting .env is not allowed from the assistant.')
        )
    second = agent.run_sync(
        message_history=first.all_messages(),
        deferred_tool_results=DeferredToolResults(approvals=decisions),  # type: ignore[arg-type]
    )
    write('approvals', second.all_messages_json())


# ---------------------------------------------------------------------------
# 8. delegation: a parent agent hands a sub-task to another agent via a tool
# ---------------------------------------------------------------------------
def delegation() -> None:
    researcher = Agent(
        TestModel(
            custom_output_text='Three sources agree: the Acme 500 heats evenly, its burners are rated 4.5/5, and the lid seal is the common complaint.'
        ),
        system_prompt='You research products and summarize findings in one paragraph.',
    )

    def model(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        last = messages[-1]
        if isinstance(last, ModelRequest) and any(p.part_kind == 'tool-return' for p in last.parts):
            return ModelResponse(
                parts=[
                    ThinkingPart('The researcher found one recurring complaint. Lead with the strengths, mention the lid seal honestly.'),
                    TextPart(
                        'The Acme 500 is well regarded: even heat and burners rated 4.5/5. The one recurring complaint is the lid seal, so check it on delivery.'
                    ),
                ],
                usage=usage(610, 58),
                model_name='demo-model-1',
                finish_reason='stop',
            )
        return ModelResponse(
            parts=[ToolCallPart('research', {'topic': 'Acme 500 grill reviews'}, tool_call_id='call_research_1')],
            usage=usage(380, 21),
            model_name='demo-model-1',
            finish_reason='tool_call',
        )

    agent = Agent(
        FunctionModel(model, model_name='demo-model-1'),
        system_prompt='You are a product advisor. Delegate research to the research agent.',
    )

    @agent.tool
    async def research(ctx: RunContext[None], topic: str) -> str:
        """Ask the research agent about a topic."""
        result = await researcher.run(f'Research: {topic}', usage=ctx.usage)
        return result.output

    result = agent.run_sync('Should I buy the Acme 500?')
    write('delegation', result.all_messages_json())


# ---------------------------------------------------------------------------
# 9. paused-conversation: a `Conversation` whose last run paused on deferred
#    tool requests, one needing approval and one an external result
# ---------------------------------------------------------------------------
def paused_conversation() -> None:
    def model(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        last = messages[-1]
        if isinstance(last, ModelRequest) and any(p.part_kind == 'tool-return' for p in last.parts):
            return ModelResponse(
                parts=[
                    ToolCallPart('refund_order', {'order_id': 'A-1042', 'amount_eur': 349.0}, tool_call_id='call_refund_1'),
                    ToolCallPart('schedule_pickup', {'order_id': 'A-1042', 'carrier': 'DHL'}, tool_call_id='call_pickup_1'),
                ],
                usage=usage(588, 52),
                model_name='demo-model-1',
                finish_reason='tool_call',
            )
        return ModelResponse(
            parts=[ToolCallPart('get_order', {'order_id': 'A-1042'}, tool_call_id='call_order_1')],
            usage=usage(402, 19),
            model_name='demo-model-1',
            finish_reason='tool_call',
        )

    agent = Agent(
        FunctionModel(model, model_name='demo-model-1'),
        system_prompt='You are a returns assistant. Refunds need approval; pickups are booked by the logistics system.',
        output_type=[str, DeferredToolRequests],
    )

    @agent.tool_plain
    def get_order(order_id: str) -> dict[str, object]:
        """Look up an order."""
        return {'order_id': order_id, 'status': 'delivered', 'total_eur': 349.0, 'item': 'Acme 500'}

    @agent.tool_plain(requires_approval=True)
    def refund_order(order_id: str, amount_eur: float) -> str:
        """Refund an order. Needs approval."""
        return f'Refunded {amount_eur} EUR for {order_id}'

    @agent.tool_plain
    def schedule_pickup(order_id: str, carrier: str) -> str:
        """Book a pickup. Executed by the logistics system, outside the run."""
        raise CallDeferred(metadata={'queue': 'logistics', 'carrier': carrier})

    result = agent.run_sync(
        'My Acme 500 arrived damaged. Please refund order A-1042 and have it picked up.',
        conversation=Conversation(conversation_id='returns-a-1042'),
    )
    assert isinstance(result.output, DeferredToolRequests)
    write('paused-conversation', ConversationTypeAdapter.dump_json(result.conversation))


# ---------------------------------------------------------------------------
# 10. stored-conversation: what a `ConversationStore` keeps, the record and
#     its entries, after a reply was regenerated on a branch
# ---------------------------------------------------------------------------
def stored_conversation() -> None:
    answers = iter(
        [
            'The Acme 500 has three burners, a cast-iron grate and a 10 year warranty on the body.',
            'Yes. It runs on propane out of the box; a natural gas conversion kit is sold separately.',
            'Yes: propane as delivered. For natural gas you need conversion kit NG-500 (49 EUR), fitted by a certified installer to keep the warranty.',
            'Plan about an hour for the fitting. Most installers charge 80 to 120 EUR.',
        ]
    )

    def model(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        return ModelResponse(
            parts=[TextPart(next(answers))],
            usage=usage(180 + 60 * len(messages), 34),
            model_name='demo-model-1',
            finish_reason='stop',
        )

    agent = Agent(
        FunctionModel(model, model_name='demo-model-1'),
        system_prompt='You are the friendly support assistant for Acme Grills. Answer briefly.',
    )

    async def run() -> bytes:
        store = InMemoryConversationStore()
        conversation_id = 'support-42'

        async def chat(prompt: str) -> None:
            conversation = await store.load(conversation_id) or Conversation(conversation_id=conversation_id)
            result = await agent.run(prompt, conversation=conversation)
            await store.save(result, scope='user-7')

        await chat('What do I get with the Acme 500?')
        await chat('Does it work with gas?')
        # Regenerate the second reply: branch after the first turn, ask again, carry on there.
        stored = await store.load(conversation_id)
        assert stored is not None
        branched = await store.branch(conversation_id, at=2, expected_revision=stored.revision)
        result = await agent.run('Does it work with gas?', conversation=branched)
        await store.save(result)
        await chat('How long does the conversion take?')

        record = await store.read_record(conversation_id)
        assert record is not None and len(record.branches) == 1
        # Every entry the record reaches: its history, then the branches it left.
        entries: dict[str, ConversationEntry] = {}
        for tip in [record.head_id, *record.branches]:
            for entry in await store.read_history(tip):
                entries.setdefault(entry.id, entry)
        return json.dumps(
            {
                'record': TypeAdapter(ConversationRecord).dump_python(record, mode='json'),
                'entries': TypeAdapter(list[ConversationEntry]).dump_python(list(entries.values()), mode='json'),
            }
        ).encode()

    write('stored-conversation', asyncio.run(run()))


# ---------------------------------------------------------------------------
# 11. deltas (test fixture): the parts that record a change to instructions,
#     model settings or loaded capabilities. A plain run does not produce
#     them, so the history is built from the message classes and serialized
#     the way a stored history is.
# ---------------------------------------------------------------------------
def deltas() -> None:
    base = InstructionPart(content='You are the support assistant for Acme Grills.', name='base')
    tone = InstructionPart(content='Answer in a friendly tone.', name='tone', id='tone', on_change='append')
    history: list[ModelMessage] = [
        ModelRequest(
            parts=[
                InstructionBaselinePart(instructions=[InstructionDigest.of(base), tone]),
                UserPromptPart('Hi, can you check my invoice?'),
            ],
            instructions=f'{base.content}\n\n{tone.content}',
        ),
        ModelResponse(
            parts=[TextPart('Sure, happy to help. Which order is it about?')],
            usage=usage(210, 14),
            model_name='demo-model-1',
            finish_reason='stop',
        ),
        ModelRequest(
            parts=[
                ModelSettingsDeltaPart(settings={'thinking': 'high'}),
                InstructionDeltaPart(id='tone', content='Answer formally: this is a billing dispute.'),
                InstructionDeltaPart(id='promo', content=None),
                CapabilityLoadDeltaPart(loaded=['billing']),
                UserPromptPart('Order A-1042. I was charged twice.'),
            ]
        ),
        ModelResponse(
            parts=[TextPart('I have opened a billing review for order A-1042. You will hear from us within two days.')],
            usage=usage(340, 26),
            model_name='demo-model-1',
            finish_reason='stop',
        ),
    ]
    path = TEST_FIXTURES / 'deltas.json'
    parsed = json.loads(ModelMessagesTypeAdapter.dump_json(history))
    path.write_text(json.dumps(parsed, indent=2, ensure_ascii=False) + '\n')
    print(f'wrote test fixture {path.name}: {len(parsed)} messages')


EXAMPLES = {
    'simple-chat': simple_chat,
    'tool-calls': tool_calls,
    'retry': retry,
    'multimodal': multimodal,
    'builtin-tools': builtin_tools,
    'structured-output': structured_output,
    'approvals': approvals,
    'delegation': delegation,
    'paused-conversation': paused_conversation,
    'stored-conversation': stored_conversation,
    'deltas': deltas,
}

if __name__ == '__main__':
    # No arguments regenerates every example; names regenerate just those.
    names = sys.argv[1:] or list(EXAMPLES)
    unknown = [name for name in names if name not in EXAMPLES]
    if unknown:
        sys.exit(f'Unknown example(s): {", ".join(unknown)}. Known: {", ".join(EXAMPLES)}')
    for name in names:
        EXAMPLES[name]()
    sys.exit(0)
