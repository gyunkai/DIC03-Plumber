This is our repo for the DIC, please add any info you want everyone to know here.

# Plumber

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

# KiwiICP Interface: Redefining AI-Powered Educational Assistance

**Team Plumber**

---

## Abstract

KiwiICP is an innovative educational assistant designed to enhance student learning by integrating AI-driven functionalities. This proposal outlines significant improvements aimed at refining the platform's usability, expanding AI-assisted learning, and offering deeper insights for educators. Our enhancements focus on structured course management, comprehensive AI-powered interactions, adaptive self-learning tools, teacher-focused analytics, and an improved user experience.

---

## 1. Introduction

As education evolves, the demand for intelligent, interactive learning tools continues to grow. KiwiICP leverages AI to provide real-time academic support, guiding students through complex concepts while ensuring accessibility to essential course materials. 

Despite previous advancements, limitations such as fragmented chat histories and restricted document scope necessitate further development. Our proposal aims to create a seamless, highly efficient, and adaptive learning environment.

---

## 2. Proposed Enhancements

### 2.1 Course Selection and Navigation

The improved interface helps students select corresponding courses more easily and clearly. Students can:

- Register and log in to personalized accounts using a secure authentication system.
- Select courses easily through an intuitive left-panel navigation system implemented using Next.js dynamic routing.
- Utilize prerequisite-based categorization for efficient content discovery, powered by a relational database structure (Prisma ORM with PostgreSQL).

### 2.2 AI-Enhanced Learning Support

To optimize AI-driven interactions, KiwiICP now enables:

- **Cross-document understanding**, allowing AI to access and relate content across multiple course materials using a vector-based search index (pgvector similarity search).
- **Intelligent linking of related topics** for holistic knowledge integration, achieved through NLP-based semantic similarity models (OpenAI embeddings or SBERT).
- **Direct navigation** to specific slides or sections within course content based on conversation context, using metadata extraction and page-level indexing.

### 2.3 Self-Assessment and Reinforcement Learning

To facilitate self-directed learning:

- On-demand quizzes tailored to reinforce weak areas, dynamically generated using a question-generation model (GPT-based).
- Personalized AI recommendations for improving knowledge retention, utilizing reinforcement learning techniques and spaced repetition algorithms.
- Progress tracking to measure improvement over time, implemented using a dashboard backed by time-series data visualization.

### 2.4 Teacher-Centric Tools and Analytics

Educators benefit from new capabilities:

- Effortless course material uploads and real-time updates, supported by a cloud-based file management system (AWS S3).
- Insights into student engagement, highlighting frequently visited topics, using heatmaps and behavioral tracking (Google Analytics or custom tracking APIs).

### 2.5 User Interface and Experience Enhancements

To improve accessibility and engagement:

- A redesigned, modern interface for an intuitive and attractive user experience, built with Tailwind CSS and React components.
- Streamlined interactions, reducing complexity in course selection and AI engagement, using optimized state management (React Context API).
- Improved system responsiveness to ensure smooth navigation and performance, achieved through server-side rendering (SSR) and caching strategies.

---

## 3. Benefits of the Enhanced KiwiICP

- **Improved Learning Efficiency** through smarter navigation and adaptive AI support.
- **Stronger Student Engagement** driven by intuitive design and interactive features.
- **Actionable Insights for Educators** via real-time analytics and student performance tracking.
- **Sustainable System Architecture** supporting easy feature expansion and long-term use.

---

## 4. Conclusion

By integrating structured navigation, AI-powered learning enhancements, adaptive self-assessment tools, and teacher-focused analytics, KiwiICP evolves into a truly comprehensive educational assistant. These refinements will significantly enhance the efficiency of both student learning and instructional strategies, setting a new standard for AI-driven education support.

---


