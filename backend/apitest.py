import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage

# Replace with your actual key or ensure it's in your environment variables
_api_key = "YOUR_API_KEY_HERE"
# uvicorn main:app --reload --port 8000
try:
    # Initializing the Gemini 3.0 Flash model
    _model = ChatGoogleGenerativeAI(
        model="gemini-3-flash-preview",
        api_key=_api_key,
        temperature=0.7
    )

    # Creating a simple test prompt
    message = HumanMessage(content="Confirm connection: What is the speed of light?")
    
    # Invoking the model
    print("--- Sending request to Gemini 3.0 Flash ---")
    response = _model.invoke([message])
    
    print("\nResponse received:")
    print(response.content)

except Exception as e:
    print(f"\n[Error]: Could not connect to the model.")
    print(f"Details: {e}")