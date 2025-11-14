# ELO Calculation Fix

## Problem

The ELO calculation was using 100 iterations with a small K-factor (8), which caused:
- **Rating collapse**: Films with many losses (like "See You Soon" with 3W-80L) would spiral down to 0 or even negative ratings
- **Unrealistic values**: The same comparisons being applied 100 times compounded rating changes exponentially
- **Stuck at 1200**: The algorithm would sometimes get stuck at starting values

## Root Cause

```javascript
// OLD (BROKEN):
for (let iteration = 0; iteration < 100; iteration++) {
  // Apply ALL comparisons 100 times
  // Each loss compounds: 1200 → 1192 → 1184 → ... → 0
}
```

For a film with 80 losses:
- Iteration 1: 1200 → ~700
- Iteration 10: ~400
- Iteration 100: ~0 or negative

## Solution

Switched to **diminishing K-factor approach**:

```javascript
// NEW (FIXED):
const maxIterations = 10; // Reduced from 100
const initialKFactor = 32; // Standard ELO

for (let iteration = 0; iteration < maxIterations; iteration++) {
  // K-factor diminishes each iteration: 32 → 22 → 16 → 11 → ...
  const kFactor = initialKFactor * Math.pow(0.7, iteration);
  
  // Randomize order for fairness
  const shuffled = comparisons.sort(() => Math.random() - 0.5);
  
  // Process each comparison once per iteration
  shuffled.forEach(comp => {
    // Apply ELO update with current K-factor
  });
}

// Safety bounds: floor at 200, ceiling at 3000
```

### Why This Works

1. **Fewer iterations (10 vs 100)**: Prevents extreme compounding
2. **Diminishing K-factor**: Early iterations have larger impact, later iterations fine-tune
   - Iteration 1: K=32 (large changes)
   - Iteration 5: K=5.4 (moderate changes)
   - Iteration 10: K=0.81 (fine-tuning)
3. **Randomized order**: Prevents systematic bias
4. **Safety bounds**: Ensures ratings stay in reasonable range (200-3000)

## Expected Results

### For "See You Soon" (3W-80L, 3.6% win rate):
- **Old algorithm**: ~0-50 ELO (unrealistic)
- **New algorithm**: ~400-600 ELO (realistic for poor record)

### For top films (70+ wins):
- Should see 2000-2800 ELO range
- Rankings should match win-based rankings closely

### For middle films (40-60 wins):
- Should see 1000-1600 ELO range
- Better reflects competitive balance

## Testing

1. **Import your JSON**: The validation will fix comparison issues
2. **Click "Recalculate ELO"**: Should see realistic ratings
3. **Check "See You Soon"**: Should be 300-700 range (not 0 or 1200)
4. **Check top films**: Should be 2000+ ELO
5. **Check ELO view**: Rankings should make sense

## Console Test

```javascript
// Check ELO distribution
const elos = app.films.map(f => f.eloRating).sort((a, b) => b - a);
console.log('Highest:', elos[0]);
console.log('Lowest:', elos[elos.length - 1]);
console.log('Average:', Math.round(elos.reduce((a, b) => a + b) / elos.length));

// Check specific film
const film = app.films.find(f => f.title.includes('See You Soon'));
if (film) {
  const wins = Object.values(film.comparisons).filter(r => r === 'win').length;
  const losses = Object.values(film.comparisons).filter(r => r === 'loss').length;
  console.log(`${film.title}: ${film.eloRating} ELO (${wins}W-${losses}L)`);
}
```

## Files Changed

- `script.js` - `recalculateEloRatings()` method (~line 1521)
- `script.js` - `handleRecalculateElo()` confirmation message (~line 1639)

## Benefits

✅ Realistic ELO ratings for all win percentages
✅ No more rating collapse to 0
✅ Faster calculation (10 iterations vs 100)
✅ Randomized order prevents bias
✅ Safety bounds prevent extreme outliers
✅ Better correlation with actual skill/quality
