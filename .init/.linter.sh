#!/bin/bash
cd /home/kavia/workspace/code-generation/client-side-notes-314834-314848/notes_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

