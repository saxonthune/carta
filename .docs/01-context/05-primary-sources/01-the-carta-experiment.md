---
title: The Carta Experiment
status: active
role: primary-source
tags: AI, coding, planning, category theory, morphisms, artifact-driven development
---

The end goal is code that implements the product, but we can also work backwards from the code. The question here is, what is the maximum distance between code and its nearest artifact, such that AI can translate between the two reliably? 
```
[ ] napkin description of product
|
v
[ ] ???
|
v
[ ] ???
|
v
[ ] code-1
|
--- planning docs above, real code below
|
v
[ ] production code
```

For example, if we know that API references can generate API implementations, then we should target API references. But they can't: maybe they can generate model validations, but not any deeper business logic, nor data storage implementation. The goal of Carta is to experimentally locate these structures sitting between napkin notes and production code. But Carta doesn't do enough to validate these structures, or lock them in place when they are located. Like a metal detector on the beach, Carta needs to beep loudly when it's near something that works. 
We need to explicitly shift our goal to discovering this code-minus-one artifact. It seems like columns of endpoint structs, then controllers, then services, then read/write instructions, then database tables, is a natural first approximation.
- Endpoint: route, verb, response model, request model, validations, middleware/policies (auth, rate-limiting, etc)
- Controllers: shows where endpoint code will live. E.g., one controller per endpoint, or per resource name, etc.
- Services: How do controller modules get grouped (or split) into services? Services can have annotations to explain business rules, like endpoint validations. What is a business rule besides a guard clause?
- Repositories: show grouping from services. What tables are queried? How is data materialized?
- Data stores: tables, attributes, constraints.
The controller-service-repository layers can be held in 'code modules' which are abstractions of classes, modules, files, etc.

Then, what is the artifact that can generate this backend model set? Artifact-driven design would tell us that the API response models are very important. Can we jump right to the napkin? No; then what? We need to understand who is consuming the API, which requires at least user stories, if not UI screens and other accessor modeling
