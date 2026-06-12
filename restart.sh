#!/bin/bash
cd ~/branicke-lahudkarstvi || exit 1

# tvrdý restart s čištěním cache: ./restart.sh --clean
if [ "$1" == "--clean" ]; then
  echo "🧹 Mažu .next cache…"
  rm -rf .next
fi

echo "🛑 Zastavuju běžící dev server (port 3000)…"
lsof -ti:3000 | xargs kill -9 2>/dev/null

echo "🚀 Spouštím dev server…"
npm run dev
