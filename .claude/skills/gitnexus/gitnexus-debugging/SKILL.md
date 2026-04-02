---
name: gitnexus-debugging
description: "Traces bugs and errors through the codebase using GitNexus code intelligence tools. Finds related execution flows via gitnexus_query, inspects callers and callees with gitnexus_context, traces full execution paths via process resources, and runs custom call-chain queries with gitnexus_cypher. Use when debugging failures, tracing error origins, identifying callers of a method, investigating 500 errors, or diagnosing intermittent issues and regressions."
---

# Debugging with GitNexus

## When to Use

- "Why is this function failing?"
- "Trace where this error comes from"
- "Who calls this method?"
- "This endpoint returns 500"
- Investigating bugs, errors, or unexpected behavior

## Workflow

1. **Find related flows**: `gitnexus_query({query: "<error or symptom>"})` — returns execution flows and symbols matching the error
2. **Inspect suspect**: `gitnexus_context({name: "<suspect>"})` — shows all callers, callees, and process participation
3. **Trace execution**: `READ gitnexus://repo/{name}/process/{name}` — step-by-step execution flow
4. **Custom traces**: `gitnexus_cypher({query: "MATCH path..."})` — when standard tools need supplementing

> If "Index is stale" → run `npx gitnexus analyze` in terminal first.

## Debugging Checklist

1. Understand the symptom (error message, unexpected behavior)
2. `gitnexus_query` for error text or related code
3. Identify the suspect function from returned processes
4. `gitnexus_context` to see callers and callees
5. Trace execution flow via process resource if applicable
6. `gitnexus_cypher` for custom call chain traces if needed
7. Read source files to confirm root cause

## Debugging Patterns

| Symptom | GitNexus Approach |
|---------|-------------------|
| Error message | `gitnexus_query` for error text → `context` on throw sites |
| Wrong return value | `context` on the function → trace callees for data flow |
| Intermittent failure | `context` → look for external calls, async deps |
| Performance issue | `context` → find symbols with many callers (hot paths) |
| Recent regression | `detect_changes` to see what your changes affect |

## Tool Reference

### gitnexus_query — find code related to error

```
gitnexus_query({query: "payment validation error"})
→ Processes: CheckoutFlow, ErrorHandling
→ Symbols: validatePayment, handlePaymentError, PaymentException
```

### gitnexus_context — full context for a suspect

```
gitnexus_context({name: "validatePayment"})
→ Incoming calls: processCheckout, webhookHandler
→ Outgoing calls: verifyCard, fetchRates (external API!)
→ Processes: CheckoutFlow (step 3/7)
```

### gitnexus_cypher — custom call chain traces

```cypher
MATCH path = (a)-[:CodeRelation {type: 'CALLS'}*1..2]->(b:Function {name: "validatePayment"})
RETURN [n IN nodes(path) | n.name] AS chain
```

## Example: "Payment endpoint returns 500 intermittently"

```
1. gitnexus_query({query: "payment error handling"})
   → Processes: CheckoutFlow, ErrorHandling
   → Symbols: validatePayment, handlePaymentError

2. gitnexus_context({name: "validatePayment"})
   → Outgoing calls: verifyCard, fetchRates (external API!)

3. READ gitnexus://repo/my-app/process/CheckoutFlow
   → Step 3: validatePayment → calls fetchRates (external)

4. Root cause: fetchRates calls external API without proper timeout
```
