"""M4: Claude API calls made by the server, instead of copying prompts by hand.

- schemas.py  what Claude must answer (structured outputs, validated with Pydantic)
- prompts.py  the instructions, ported from web/src/lib/prompts.ts
- cost.py     price list and cost of one call
- client.py   one call: request, checks, cost, a row in llm_calls
- fake.py     a deterministic stand-in for tests and CI (LLM_FAKE=1), never used with a real key
- api.py      /api/llm/{status,lesson,week}
"""
