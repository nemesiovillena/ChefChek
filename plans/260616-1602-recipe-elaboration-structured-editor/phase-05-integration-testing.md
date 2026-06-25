---
phase: 5
title: "Integration & Testing"
status: pending
priority: P2
effort: "2h"
dependencies: [3, 4]
---

# Phase 5: Integration & Testing

## Overview
End-to-end testing of the structured elaboration flow: create recipe with steps → edit → print → PDF generation. Verify backward compatibility with existing recipes.

## Implementation Steps
1. Start backend (`bun run start:dev`) and frontend (`bun run dev`)
2. Create a new recipe "Brownie" using the step editor — replicate brownie.pdf data
   - 10 steps with equipment tags, times, temperatures
   - Add ingredients
   - Add notes ("Salen 28 und. Se corta 4x6. Se envasa de 4 und.")
3. Save and verify recipe appears in list
4. Edit the recipe — verify steps populate correctly from JSON
5. Add/remove/reorder steps — verify JSON updates
6. Click print — verify layout matches brownie.pdf reference
7. Test with existing recipe (legacy TipTap JSON) — verify fallback display
8. Test PDF generation via technical-sheets endpoint
9. Test edge cases:
   - Recipe with no steps (empty elaboration)
   - Step with only description (no equipment/time/temp)
   - Very long description text
   - Custom equipment text not in predefined list
10. Fix any issues found

## Success Criteria
- [ ] New recipe creation with structured steps works
- [ ] Editing populates step editor from saved JSON
- [ ] Print view matches brownie.pdf format
- [ ] PDF generation renders structured steps correctly
- [ ] Legacy recipes with TipTap JSON display without errors
- [ ] Backend compiles and runs without errors
- [ ] Frontend compiles without TypeScript errors

## Risk Assessment
- **Regression**: Changes to elaboration validation may break existing API calls — test with curl/Postman
- **Data integrity**: Migration must not corrupt existing elaboration data
