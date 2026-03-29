#!/bin/bash
echo "Testing API loaded"
curl -s http://localhost:5001/api/health | grep healthy
