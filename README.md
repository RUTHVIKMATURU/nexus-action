# NexusAction - Intelligent Next Best Action Platform

**NexusAction** is a reusable Agentic Decision Intelligence Platform designed to transform customer interactions and enterprise knowledge into actionable recommendations. It intelligently determines the next best actions by combining contextual understanding, organizational knowledge, and business reasoning.

This project was built for **Hackathon Project 2: Intelligent Next Best Action Platform**.

---

## 🚀 Objective

Design and build an intelligent, explainable, and extensible AI platform capable of assisting business users in making better decisions. The focus is on building a reusable agentic platform—not simply a chatbot or standard RAG application.

---

## 💼 Business Challenge (B2B Sales Intelligence)

NexusAction focuses on the **B2B Sales domain**. It dynamically orchestrates specialized agents using a Planner Agent to complete the following end-to-end workflow:

1. **Ingest Interactions**: Ingests customer interactions such as meeting notes, transcripts, CRM updates, emails, or conversations.
2. **Gather Context**: Gathers relevant organizational context from enterprise knowledge sources (e.g., knowledge articles, playbooks, CRM data, customer history).
3. **Analyze Context**: Analyzes the business context to identify opportunities, risks, and missing information.
4. **Recommend Actions**: Recommends the most appropriate next best actions for the user.
5. **Explain Reasoning**: Explains the reasoning behind each recommendation with supporting evidence and confidence scores.
6. **Human-in-the-Loop**: Supports human-in-the-loop review before recommendations are accepted or executed.
7. **Learn & Improve**: Learns from previous interactions using shared memory to continuously improve future recommendations.

---

## 🏗 Platform Architecture & Expectations

NexusAction is designed as a reusable platform with the following capabilities:

*   **Dynamic Orchestration**: Planner-based agent orchestration using LangGraph.
*   **Reusable Architecture**: Extensible agent and tool architecture.
*   **Shared Memory**: Memory for customer interactions and organizational context.
*   **Advanced Retrieval**: Retrieval and reasoning across multiple enterprise knowledge sources.
*   **Explainability**: Explainable recommendations with supporting evidence.
*   **Configurability**: Configurable workflows and business rules.
*   **Intuitive UX**: A seamless and intuitive user experience for interacting with the platform.

### Tech Stack
*   **Frontend**: React, Vite, TailwindCSS, Firebase (Authentication/Hosting)
*   **Backend**: Node.js, Express, Mongoose, Firebase Admin SDK
*   **Agent Engine**: Python, FastAPI, LangGraph, Uvicorn

---

## 🛠 Setup Instructions

### Prerequisites
*   Node.js (v18+)
*   Python (3.9+)
*   MongoDB Instance
*   Firebase Project (for authentication)

### 1. Frontend Setup
```bash
cd frontend
npm install
# Create a .env file based on .env.example with your Firebase config
npm run dev
```

### 2. Backend Setup
```bash
cd backend
npm install
# Create a .env file with your MongoDB URI and Firebase Admin credentials
npm run dev
```
*(Runs on `http://localhost:5000` or port specified in `.env`)*

### 3. Agent Engine Setup
```bash
cd agent-engine
# Create a virtual environment (optional but recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies from the requirements file
pip install -r requirements.txt

# Create a .env file with your API keys (e.g., LLM_API_KEYS=key1,key2)
uvicorn app.main:app --reload
```
*(Runs on `http://localhost:8000`)*

---

## 🌐 Deployment Instructions

### Frontend Deployment
The React frontend can be easily deployed to **Vercel**, **Netlify**, or **Firebase Hosting**.
1. Run `npm run build` to generate the production bundle.
2. Deploy the `dist` folder to your chosen platform.

### Backend Deployment
The Node.js backend can be deployed to platforms like **Render**, **Railway**, or **Heroku**.
1. Set the environment variables (`MONGO_URI`, `PORT`, Firebase Admin credentials) in the deployment dashboard.
2. Start the server using `node server.js`.

### Agent Engine Deployment
The Python FastAPI engine can be deployed using Docker or directly on platforms like **Render**, **AWS App Runner**, or **GCP Cloud Run**.
1. Ensure all dependencies are listed in a `requirements.txt`.
2. Set up environment variables for AI model API keys.
3. Use the start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.

---

## 📊 Evaluation & Deliverables

This platform was built to meet the hackathon evaluation criteria:
*   **Platform (70%)**: Quality of Agentic AI architecture, reusability, memory/orchestration design, user experience, and creativity.
*   **Business Use Case (30%)**: Understanding of the B2B domain, effectiveness of reasoning, quality of next best actions, and measurable business outcomes.
