# Ion Strategic Dashboard

A strategic dashboard integrating Jira data and AI analytics for comprehensive project tracking.

## 🚀 Running on Ubuntu/Linux (Encapsulated)

This application is designed to be easily deployed as an encapsulated Docker container.

### Prerequisites
- **Docker** and **Docker Compose** must be installed on your system.
  - If not installed, `run_encapsulated.sh` will prompt you with installation commands.

### Quick Start
We provide a helper script to build and run the application:

```bash
chmod +x run_encapsulated.sh
./run_encapsulated.sh
```

This script will:
1. Check if Docker is available.
2. Build the Docker image.
3. Start the application container in the background.

**Access the application at:**  
👉 [http://localhost:3001](http://localhost:3001)

### Manual Docker Commands
If you prefer running Docker Compose directly:

```bash
docker compose up -d --build
```

To stop the application:
```bash
docker compose down
```

---

## 🛠 Development Directory

If you want to run the application in development mode (with hot-reload):

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run the dev start script:
   ```bash
   ./start.sh
   ```

This starts:
- Proxy Server on port 3001
- Vite Dev Server on port 5173
