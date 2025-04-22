import os
from flask import Flask, jsonify, request, Response, send_file
from dotenv import load_dotenv, find_dotenv
import psycopg2
from psycopg2.extras import Json
from urllib.parse import urlparse
from collections import Counter
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any
from langchain_openai import ChatOpenAI
from langchain.prompts import PromptTemplate
from langchain.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field
from typing import List, Optional
import openai
import tempfile
import io

# Load environment variables
env_path = find_dotenv()
load_dotenv(env_path, override=True)

app = Flask(__name__)

# Initialize OpenAI client
openai.api_key = os.getenv("OPENAI_API_KEY")

# Initialize OpenAI LLM
llm = ChatOpenAI(
    openai_api_key=os.getenv("OPENAI_API_KEY"),
    model="gpt-4",
    temperature=0
)

class TopicInsight(BaseModel):
    topic: str = Field(description="The main topic discussed")
    frequency: int = Field(description="How many times this topic was discussed")
    subtopics: List[str] = Field(description="Related subtopics discussed")
    difficulty_level: str = Field(description="Perceived difficulty level: basic, intermediate, or advanced")
    understanding: str = Field(description="Assessment of user's understanding: struggling, growing, or proficient")

class ConversationAnalysis(BaseModel):
    main_topics: List[TopicInsight] = Field(description="List of main topics discussed")
    learning_patterns: List[str] = Field(description="Identified learning patterns and behaviors")
    areas_of_confusion: List[str] = Field(description="Topics or concepts where the user showed confusion")
    suggested_focus: List[str] = Field(description="Suggested areas for future focus")
    engagement_level: str = Field(description="Overall engagement level: low, medium, or high")

def get_db_connection():
    """Create a database connection"""
    try:
        db_url = os.getenv("DATABASE_URL3")
        if not db_url:
            raise ValueError("DATABASE_URL3 environment variable is not set")
        
        parsed = urlparse(db_url)
        conn = psycopg2.connect(
            dbname=parsed.path[1:],
            user=parsed.username,
            password=parsed.password,
            host=parsed.hostname,
            port=parsed.port or 5432,
            sslmode='require'
        )
        return conn
    except Exception as e:
        print(f"Error connecting to database: {str(e)}")
        raise

def analyze_with_llm(conversation_history: List[Dict]) -> Dict[str, Any]:
    """Use LangChain and OpenAI to analyze conversation history"""
    
    # Format conversation for analysis
    formatted_conversation = "\n".join([
        f"{msg['sender']}: {msg['message']}"
        for msg in conversation_history
    ])

    # Create output parser
    parser = PydanticOutputParser(pydantic_object=ConversationAnalysis)

    # Create analysis prompt
    analysis_prompt = PromptTemplate(
        template="""You are an expert educational analyst specializing in computer science and machine learning.
        Analyze the following conversation between a user and an AI tutor to extract meaningful insights.
        Focus on identifying main topics, learning patterns, areas of confusion, and the user's level of understanding.

        Conversation:
        {conversation}

        Provide a detailed analysis following this format:
        {format_instructions}

        Remember to:
        1. Identify specific topics and subtopics in machine learning and computer science
        2. Assess the user's understanding level for each topic
        3. Note any patterns in the user's learning approach
        4. Identify areas where the user seems confused or needs more help
        5. Suggest areas for future focus based on the conversation

        Provide your analysis in the exact JSON format specified above.
        """,
        input_variables=["conversation"],
        partial_variables={"format_instructions": parser.get_format_instructions()}
    )

    # Get analysis from LLM
    analysis_input = analysis_prompt.format(conversation=formatted_conversation)
    analysis_output = llm.invoke(analysis_input)
    
    try:
        # Parse the response into our Pydantic model
        analysis = parser.parse(analysis_output.content)
        return analysis.dict()
    except Exception as e:
        print(f"Error parsing LLM output: {e}")
        # Fallback to raw output if parsing fails
        return {"raw_analysis": analysis_output.content}

@app.route('/analytics/session/<session_id>', methods=['GET'])
def get_session_analytics(session_id: str):
    """Get analytics for a specific session"""
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT conversationhistory, sessionStartTime, sessionEndTime
                FROM "UserSession"
                WHERE id = %s
            """, (session_id,))
            
            result = cursor.fetchone()
            if not result:
                return jsonify({'error': 'Session not found'}), 404

            conversation_history, start_time, end_time = result
            
            # Get LLM analysis
            llm_analysis = analyze_with_llm(conversation_history)
            
            # Add session duration
            if end_time:
                duration = (end_time - start_time).total_seconds()
            else:
                duration = (datetime.now() - start_time).total_seconds()
            
            return jsonify({
                'success': True,
                'analytics': {
                    'llm_analysis': llm_analysis,
                    'session_duration': duration,
                    'message_count': len(conversation_history)
                }
            })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/analytics/user/<user_id>', methods=['GET'])
def get_user_analytics(user_id: str):
    """Get aggregated analytics for all sessions of a user"""
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT conversationhistory, sessionStartTime, sessionEndTime
                FROM "UserSession"
                WHERE "userId" = %s
                ORDER BY sessionStartTime DESC
            """, (user_id,))
            
            sessions = cursor.fetchall()
            if not sessions:
                return jsonify({'error': 'No sessions found for user'}), 404

            # Combine all conversations for overall analysis
            all_conversations = []
            total_duration = 0
            for conversation_history, start_time, end_time in sessions:
                all_conversations.extend(conversation_history)
                if end_time:
                    duration = (end_time - start_time).total_seconds()
                else:
                    duration = (datetime.now() - start_time).total_seconds()
                total_duration += duration

            # Get comprehensive LLM analysis
            overall_analysis = analyze_with_llm(all_conversations)

            return jsonify({
                'success': True,
                'analytics': {
                    'session_count': len(sessions),
                    'total_messages': len(all_conversations),
                    'average_session_duration': total_duration / len(sessions),
                    'learning_analysis': overall_analysis
                }
            })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/analytics/topics/learning-progress', methods=['GET'])
def get_learning_progress():
    """Analyze learning progress across all sessions in the last 7 days"""
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT conversationhistory, userId
                FROM "UserSession"
                WHERE sessionStartTime > NOW() - INTERVAL '7 days'
                ORDER BY userId, sessionStartTime
            """)
            
            sessions = cursor.fetchall()
            if not sessions:
                return jsonify({'error': 'No recent sessions found'}), 404

            # Group conversations by user
            user_conversations = {}
            for conversation_history, user_id in sessions:
                if user_id not in user_conversations:
                    user_conversations[user_id] = []
                user_conversations[user_id].extend(conversation_history)

            # Analyze learning progress for each user
            learning_progress = {}
            for user_id, conversations in user_conversations.items():
                analysis = analyze_with_llm(conversations)
                learning_progress[user_id] = analysis

            return jsonify({
                'success': True,
                'learning_progress': learning_progress
            })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

def text_to_speech(text: str, voice: str = "alloy", model: str = "tts-1") -> bytes:
    """
    Convert text to speech using OpenAI's TTS API
    Args:
        text (str): Text to convert to speech
        voice (str): Voice to use (alloy, echo, fable, onyx, nova, shimmer)
        model (str): Model to use (tts-1 or tts-1-hd)
    Returns:
        bytes: Audio data
    """
    try:
        response = openai.audio.speech.create(
            model=model,
            voice=voice,
            input=text
        )
        return response.content
    except Exception as e:
        print(f"Error in text_to_speech: {e}")
        raise

@app.route('/analytics/tts', methods=['POST'])
def generate_speech():
    """Generate speech from text using OpenAI TTS"""
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({'error': 'Missing text in request'}), 400

        text = data['text']
        voice = data.get('voice', 'alloy')
        model = data.get('model', 'tts-1')

        # Generate speech
        audio_data = text_to_speech(text, voice, model)

        # Create a temporary file to store the audio
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as temp_file:
            temp_file.write(audio_data)
            temp_file_path = temp_file.name

        # Return the audio file
        return send_file(
            temp_file_path,
            mimetype='audio/mpeg',
            as_attachment=True,
            download_name='speech.mp3'
        )

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        # Clean up the temporary file
        if 'temp_file_path' in locals():
            try:
                os.unlink(temp_file_path)
            except Exception as e:
                print(f"Error cleaning up temp file: {e}")

@app.route('/analytics/tts/stream', methods=['POST'])
def stream_speech():
    """Stream speech generation for real-time playback"""
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({'error': 'Missing text in request'}), 400

        text = data['text']
        voice = data.get('voice', 'alloy')
        model = data.get('model', 'tts-1')

        # Generate speech
        audio_data = text_to_speech(text, voice, model)

        # Create a response with the audio data
        return Response(
            audio_data,
            mimetype='audio/mpeg',
            headers={
                'Content-Disposition': 'attachment; filename=speech.mp3',
                'Cache-Control': 'no-cache',
                'Transfer-Encoding': 'chunked'
            }
        )

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('ANALYTICS_PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True) 