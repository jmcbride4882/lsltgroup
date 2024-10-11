#!/bin/bash

# Define the path to your .env file
ENV_FILE="lslt-portal/employee-service/.env"

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
  echo ".env file not found at $ENV_FILE. Please ensure the file exists."
  exit 1
fi

# Load environment variables from the .env file
source "$ENV_FILE"

# Function to update or add a variable in the .env file
update_env_var() {
  VAR_NAME=$1
  VAR_VALUE=$2

  # Check if the variable already exists in the .env file
  if grep -q "^$VAR_NAME=" "$ENV_FILE"; then
    # Update the existing variable
    sed -i "s/^$VAR_NAME=.*/$VAR_NAME=$VAR_VALUE/" "$ENV_FILE"
  else
    # Add the variable to the end of the file
    echo "$VAR_NAME=$VAR_VALUE" >> "$ENV_FILE"
  fi
}

# Check if DB_PASSWORD is set and non-empty
if [ -z "$DB_PASSWORD" ]; then
  echo "DB_PASSWORD is missing or empty in .env file."
  read -p "Enter the DB_PASSWORD: " DB_PASSWORD_INPUT
  update_env_var "DB_PASSWORD" "$DB_PASSWORD_INPUT"
  echo "DB_PASSWORD has been updated in .env file."
else
  echo "DB_PASSWORD is correctly set in the .env file."
fi

# Check if JWT_SECRET is set and non-empty
if [ -z "$JWT_SECRET" ]; then
  echo "JWT_SECRET is missing or empty in .env file."
  read -p "Enter the JWT_SECRET: " JWT_SECRET_INPUT
  update_env_var "JWT_SECRET" "$JWT_SECRET_INPUT"
  echo "JWT_SECRET has been updated in .env file."
else
  echo "JWT_SECRET is correctly set in the .env file."
fi

# Restart the Node.js service
echo "Restarting the Employee Service..."
# Find the PID of the running Node.js process and kill it if it exists
PID=$(pgrep -f "node server.js")
if [ ! -z "$PID" ]; then
  echo "Stopping the current Employee Service process (PID: $PID)..."
  kill $PID
fi

# Start the service again
cd lslt-portal/employee-service
nohup npx nodemon server.js &

echo "Employee Service has been restarted."

