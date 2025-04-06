import os
from flask import Flask, jsonify, request, Response, send_file
from flask_cors import CORS
from dotenv import load_dotenv, find_dotenv
import openai
import tempfile
from typing import Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
env_path = find_dotenv()
load_dotenv(env_path, override=True)

app = Flask(__name__)
# Configure CORS to allow requests from Next.js development server
CORS(app, resources={
    r"/*": {
        "origins": [
            "http://localhost:3000",  # Next.js development server
            "http://127.0.0.1:3000",
        ],
        "methods": ["POST", "GET", "OPTIONS"],
        "allow_headers": ["Content-Type", "Accept"],
    }
})

# Initialize OpenAI client
openai.api_key = os.getenv("OPENAI_API_KEY")

# Available voices and models
AVAILABLE_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"]
AVAILABLE_MODELS = ["tts-1", "tts-1-hd"]

def text_to_speech(
    text: str,
    voice: str = "alloy",
    model: str = "tts-1",
    speed: float = 1.0
) -> bytes:
    """
    Convert text to speech using OpenAI's TTS API
    Args:
        text (str): Text to convert to speech
        voice (str): Voice to use (alloy, echo, fable, onyx, nova, shimmer)
        model (str): Model to use (tts-1 or tts-1-hd)
        speed (float): Speed multiplier (0.25 to 4.0)
    Returns:
        bytes: Audio data
    """
    try:
        # Validate inputs
        if voice not in AVAILABLE_VOICES:
            raise ValueError(f"Invalid voice. Must be one of: {', '.join(AVAILABLE_VOICES)}")
        if model not in AVAILABLE_MODELS:
            raise ValueError(f"Invalid model. Must be one of: {', '.join(AVAILABLE_MODELS)}")
        if not 0.25 <= speed <= 4.0:
            raise ValueError("Speed must be between 0.25 and 4.0")

        logger.info(f"Generating speech for text (length: {len(text)}) with voice: {voice}, model: {model}, speed: {speed}")
        
        response = openai.audio.speech.create(
            model=model,
            voice=voice,
            input=text,
            speed=speed
        )
        
        logger.info("Speech generation successful")
        return response.content
    except Exception as e:
        logger.error(f"Error in text_to_speech: {e}")
        raise

@app.route('/tts', methods=['POST'])
def generate_speech():
    """Generate speech from text using OpenAI TTS"""
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({'error': 'Missing text in request'}), 400

        text = data['text']
        voice = data.get('voice', 'alloy')
        model = data.get('model', 'tts-1')
        speed = float(data.get('speed', 1.0))

        # Generate speech
        audio_data = text_to_speech(text, voice, model, speed)

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

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error generating speech: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        # Clean up the temporary file
        if 'temp_file_path' in locals():
            try:
                os.unlink(temp_file_path)
            except Exception as e:
                logger.error(f"Error cleaning up temp file: {e}")

@app.route('/tts/stream', methods=['POST'])
def stream_speech():
    """Stream speech generation for real-time playback"""
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({'error': 'Missing text in request'}), 400

        text = data['text']
        voice = data.get('voice', 'alloy')
        model = data.get('model', 'tts-1')
        speed = float(data.get('speed', 1.0))

        # Generate speech
        audio_data = text_to_speech(text, voice, model, speed)
        logger.info(f"Generated audio data size: {len(audio_data)} bytes")

        # Create a response with the audio data
        response = Response(
            audio_data,
            mimetype='audio/mpeg',
            headers={
                'Content-Type': 'audio/mpeg',
                'Cache-Control': 'no-cache',
                'Access-Control-Allow-Origin': '*'
            }
        )
        
        return response

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error streaming speech: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/tts/voices', methods=['GET'])
def get_available_voices():
    """Get list of available voices"""
    return jsonify({
        'voices': AVAILABLE_VOICES,
        'models': AVAILABLE_MODELS
    })

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'openai_api_configured': bool(openai.api_key)
    })

if __name__ == '__main__':
    port = int(os.getenv('TTS_PORT', 5002))
    app.run(host='0.0.0.0', port=port, debug=True) 