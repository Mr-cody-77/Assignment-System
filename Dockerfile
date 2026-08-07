# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies (compilers, Node.js, and DB libs)
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    build-essential \
    default-jdk \
    gcc \
    g++ \
    libpq-dev \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy the requirements file and install Python dependencies
# (Handling the specific spelling of the requirements file)
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire project into the container
COPY . /app/

# Install frontend dependencies for React
WORKDIR /app/Frontend/system_interface
RUN npm install

# Return to root working directory
WORKDIR /app

# Expose ports:
# 8000 is the default port for whichever service is launched (DB, Gateway, or Worker)
# 3000 is the default port for the React frontend dev server
EXPOSE 8000
EXPOSE 3000

# By default, display the help menu for the orchestrator
# Users can override this by passing arguments like:
# docker run -p 8000:8000 -p 3000:3000 my-image python cli.py --assignment --port 8000
CMD ["python", "cli.py", "--help"]
