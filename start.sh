#!/bin/bash

# ============================================
# AI Photography Business Manager - Start Script
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${PURPLE}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${PURPLE}║${NC}  ${CYAN}📸 AI Photography Business Manager${NC}              ${PURPLE}║${NC}"
echo -e "${PURPLE}║${NC}  ${YELLOW}Starting all services...${NC}                        ${PURPLE}║${NC}"
echo -e "${PURPLE}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ----- Clean up ports -----
echo -e "${YELLOW}🔧 Cleaning up ports 3000, 3001...${NC}"
for PORT in 3000 3001; do
    PID=$(lsof -ti:$PORT 2>/dev/null || true)
    if [ -n "$PID" ]; then
        echo -e "   ${RED}Killing process on port $PORT (PID: $PID)${NC}"
        kill -9 $PID 2>/dev/null || true
        sleep 1
    fi
done
echo -e "${GREEN}✅ Ports cleaned${NC}"

# ----- Check PostgreSQL -----
echo -e "\n${YELLOW}🐘 Checking PostgreSQL...${NC}"
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ PostgreSQL not found. Please install PostgreSQL.${NC}"
    exit 1
fi

# Try to start PostgreSQL if not running
if ! pg_isready -q 2>/dev/null; then
    echo -e "${YELLOW}   Starting PostgreSQL...${NC}"
    if command -v brew &> /dev/null; then
        brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null || true
    fi
    sleep 2
fi

if pg_isready -q 2>/dev/null; then
    echo -e "${GREEN}✅ PostgreSQL is running${NC}"
else
    echo -e "${RED}❌ PostgreSQL is not running. Please start it manually.${NC}"
    exit 1
fi

# ----- Load .env -----
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

DB_NAME="${DB_NAME:-photo_business}"
DB_USER="${DB_USER:-postgres}"

# ----- Setup Database -----
echo -e "\n${YELLOW}🗄️  Setting up database...${NC}"

# Create database if not exists
psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" 2>/dev/null | grep -q 1 || \
    psql -U postgres -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || \
    createdb "$DB_NAME" 2>/dev/null || \
    echo -e "   ${YELLOW}Database may already exist${NC}"

echo -e "${GREEN}✅ Database ready${NC}"

# ----- Install Dependencies -----
echo -e "\n${YELLOW}📦 Installing backend dependencies...${NC}"
cd "$SCRIPT_DIR/backend"
npm install --silent 2>&1 | tail -1
echo -e "${GREEN}✅ Backend dependencies installed${NC}"

echo -e "\n${YELLOW}📦 Installing frontend dependencies...${NC}"
cd "$SCRIPT_DIR/frontend"
npm install --silent 2>&1 | tail -1
echo -e "${GREEN}✅ Frontend dependencies installed${NC}"

# ----- Seed Database -----
echo -e "\n${YELLOW}🌱 Seeding database...${NC}"
cd "$SCRIPT_DIR/backend"
node seed.js
echo -e "${GREEN}✅ Database seeded${NC}"

# ----- Start Backend with hot reload -----
echo -e "\n${YELLOW}🚀 Starting backend (port 3001) with hot reload...${NC}"
cd "$SCRIPT_DIR/backend"
npx nodemon server.js &
BACKEND_PID=$!
echo -e "${GREEN}✅ Backend started (PID: $BACKEND_PID)${NC}"

# Wait for backend
sleep 2

# ----- Start Frontend with hot reload -----
echo -e "\n${YELLOW}🚀 Starting frontend (port 3000) with hot reload...${NC}"
cd "$SCRIPT_DIR/frontend"
BROWSER=none PORT=3000 npm start &
FRONTEND_PID=$!
echo -e "${GREEN}✅ Frontend started (PID: $FRONTEND_PID)${NC}"

# ----- Cleanup handler -----
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down...${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    for PORT in 3000 3001; do
        PID=$(lsof -ti:$PORT 2>/dev/null || true)
        if [ -n "$PID" ]; then
            kill -9 $PID 2>/dev/null || true
        fi
    done
    echo -e "${GREEN}✅ All services stopped${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# ----- Ready -----
echo ""
echo -e "${PURPLE}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${PURPLE}║${NC}  ${GREEN}🎉 All services are running!${NC}                    ${PURPLE}║${NC}"
echo -e "${PURPLE}║${NC}                                                  ${PURPLE}║${NC}"
echo -e "${PURPLE}║${NC}  ${CYAN}Frontend:${NC}  http://localhost:3000                ${PURPLE}║${NC}"
echo -e "${PURPLE}║${NC}  ${CYAN}Backend:${NC}   http://localhost:3001                ${PURPLE}║${NC}"
echo -e "${PURPLE}║${NC}                                                  ${PURPLE}║${NC}"
echo -e "${PURPLE}║${NC}  ${YELLOW}Login:${NC}     admin@photostudio.com / admin123    ${PURPLE}║${NC}"
echo -e "${PURPLE}║${NC}                                                  ${PURPLE}║${NC}"
echo -e "${PURPLE}║${NC}  ${RED}Press Ctrl+C to stop all services${NC}              ${PURPLE}║${NC}"
echo -e "${PURPLE}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# Open browser after a delay
sleep 3
open http://localhost:3000 2>/dev/null || true

# Keep running
wait
