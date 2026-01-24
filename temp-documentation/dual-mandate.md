# The Dual-Mandate

When working on the core design of Carta, it must fulfill two objectives. The first is properly bounded modeling capability, and the other is semantically sufficient compilation. The dual-mandate of Carta is to balance these two objectives. Design decisions of Carta itself must cohere with the dual-mandate.

## Properly Bounded Modeling Capability

Carta gives its users the ability to model their own domains. Domains can range from software architecture to sentence diagramming to electrical circuitry, and the level of specificity can range from abstract (e.g., User - UI - API - Data Store) to extremely granular (database attribute constraints, assembly instructions chained by execution order).

To facilitate this range of requirements, Carta can provide a range of modeling capability -- in metamodel terms, M2 primitives and structure. The tooling must have sufficient flexibility and robustness such that a user can model their domain, no matter the subject matter or level of granularity. On the other hand, the tooling must also be restrictive. If the tooling is too permissive, then some users might drown themselves in options, and create a muddled model.

We can conceptualize a metric for 'modeling capability.' There is a subset of this 'modeling capability' metric space whose infinum and supremum are determined by modeling capabilities which are 'too restrictive' and 'not restrictive enough', respectively. Carta's modeling capability must fall within this range.

## Semantically sufficient compilation

The state of a user's data in Carta -- the models, and the instances of models along with their relationships and metadata -- must be converted into instructions that an AI agent can interface with. An AI agent should be able to extract meaning from the state, and translate it into other forms, such as textual explanations to a user, or working production code. To meet this requirement, Carta's modeling capability must store a sufficient amount of semantic data in its state, so that different instances can be differentiated from each other, that the relationships between model schema are differentiable, and so on. If a coding agent cannot write high-quality code from the state, then there are at least three possible failure points. First, the conversion from state to AI context has failed; this is a failure to preserve structure. Second, the user may not have put enough data into their model; this is a failure to create enough semantic meaning to preserve in the first place. In the case of this second type of failure, it is possible that Carta did not provide enough modeling capability to the user, or that the metamodel was too complicated for the user to apply effectively.

Carta's designs should strive to avoid all of its possible failures, except for the case where the user needs to add more meaning to the state (and has the capability to do so easily)
