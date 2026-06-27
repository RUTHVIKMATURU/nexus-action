from langgraph.graph import StateGraph, START, END
from app.schemas.state import AgentState
from app.nodes.agentNodes import planner_node, retriever_node, reasoner_node

# Define a new StateGraph using our AgentState Pydantic model
workflow = StateGraph(AgentState)

# Add the specialized nodes to the graph
workflow.add_node("planner", planner_node)
workflow.add_node("retriever", retriever_node)
workflow.add_node("reasoner", reasoner_node)

# Define execution edges to chain nodes sequentially
workflow.add_edge(START, "planner")
workflow.add_edge("planner", "retriever")
workflow.add_edge("retriever", "reasoner")
workflow.add_edge("reasoner", END)

# Compile the workflow graph
compiled_graph = workflow.compile()
