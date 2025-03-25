This is our repo for the DIC, please add any info you want everyone to know here.

# Plumber - Digital Interactive Companion

A smart learning assistant that helps students study lecture materials through conversation and interactive quizzes.

## Environment Setup

### Creating a Conda Environment

To ensure a consistent development environment, follow these steps to create a conda environment with all the required dependencies:

```bash
# Create a new conda environment named 'plumber' with Python 3.9
conda create -n plumber python=3.9

# Activate the environment
conda activate plumber

# Install core dependencies
pip install langchain langchain-core langchain-openai

# Install document processing dependencies
pip install langchain-community pymupdf pypdf boto3

# Install database dependencies
pip install psycopg2-binary

# Install web server dependencies for Kiwi_bot
pip install flask python-dotenv

# Install other utilities
pip install tqdm numpy

# Install Next.js dependencies (from the project root)
npm install
```

### Environment Variables

Make sure to set up your environment variables in a `.env` file at the root of the project:

```
# OpenAI API Key for embeddings and chat
OPENAI_API_KEY=your_openai_api_key

# Database connection
DATABASE_URL3=your_database_connection_string

# AWS credentials (for S3 access)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_S3_BUCKET_NAME=your_s3_bucket_name
```

## Running the Application

1. Start the backend (Kiwi Bot)

   ```bash
   cd Kiwi_bot
   python kiwi_flask.py
   ```

2. Start the frontend (Next.js app)

   ```bash
   # From the project root
   npm run dev
   ```

3. Open your browser and navigate to http://localhost:3000
