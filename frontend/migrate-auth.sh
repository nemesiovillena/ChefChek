#!/bin/bash

pages=("technical-sheets" "ocr-ai" "allergens" "digital-menu" "appcc" "production" "orders" "warehouse" "sprint-tracker")

for page in "${pages[@]}"; do
  file="src/app/dashboard/$page/page.tsx"
  
  echo "Migrating $file..."
  
  # Add imports if not already there
  sed -i.bak '' "1,/^'use client';$/s|'use client';|'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';|" "$file"
  
  # Add export const dynamic after use client
  if ! grep -q "export const dynamic = 'force-dynamic'" "$file"; then
    sed -i.bak2 '' "/^'use client';$/a\\
\\
export const dynamic = 'force-dynamic';" "$file"
  fi
  
  # Add auth check at the start of the component
  # This is complex, so I'll do it manually for each page
done

echo "Migration complete"
