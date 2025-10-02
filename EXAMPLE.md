# Discord Shopping List Bot - Visual Example

## How It Works - Step by Step

### 1. Create a Shopping List
```
User: /shop create "Weekly Groceries" milk;bread;eggs;apples

Bot Response:
╭─────────────────────────────────╮
│ 🛒 Weekly Groceries             │
│                                 │
│ 1️⃣ ⬜ milk                      │
│ 2️⃣ ⬜ bread                     │
│ 3️⃣ ⬜ eggs                      │
│ 4️⃣ ⬜ apples                    │
│                                 │
│ Click number emojis to check/   │
│ uncheck items • ➕ Add item •   │
│ ✏️ Edit                         │
╰─────────────────────────────────╯
Reactions: 1️⃣ 2️⃣ 3️⃣ 4️⃣ ➕ ✏️
```

### 2. User Clicks 1️⃣ (Check milk)
```
Bot: "✅ user checked: milk"

Updated List:
╭─────────────────────────────────╮
│ 🛒 Weekly Groceries             │
│                                 │
│ 1️⃣ ✅ ~~milk~~                  │
│ 2️⃣ ⬜ bread                     │
│ 3️⃣ ⬜ eggs                      │
│ 4️⃣ ⬜ apples                    │
│                                 │
│ Progress: 1/4 items checked     │
│                                 │
│ Click number emojis to check/   │
│ uncheck items • 🧹 Clear comp-  │
│ leted • ➕ Add item • ✏️ Edit   │
╰─────────────────────────────────╯
Reactions: 1️⃣ 2️⃣ 3️⃣ 4️⃣ 🧹 ➕ ✏️
```

### 3. User Clicks 2️⃣ and 3️⃣ (Check bread and eggs)
```
Bot: "✅ user checked: bread"
Bot: "✅ user checked: eggs"

Updated List:
╭─────────────────────────────────╮
│ 🛒 Weekly Groceries             │
│                                 │
│ 1️⃣ ✅ ~~milk~~                  │
│ 2️⃣ ✅ ~~bread~~                 │
│ 3️⃣ ✅ ~~eggs~~                  │
│ 4️⃣ ⬜ apples                    │
│                                 │
│ Progress: 3/4 items checked     │
│                                 │
│ Click number emojis to check/   │
│ uncheck items • 🧹 Clear comp-  │
│ leted • ➕ Add item • ✏️ Edit   │
╰─────────────────────────────────╯
Reactions: 1️⃣ 2️⃣ 3️⃣ 4️⃣ 🧹 ➕ ✏️
```

### 4. User Clicks 🧹 (Clear completed items)
```
Bot: "🧹 user cleared 3 completed items!"

Updated List:
╭─────────────────────────────────╮
│ 🛒 Weekly Groceries             │
│                                 │
│ 1️⃣ ⬜ apples                    │
│                                 │
│ Click number emojis to check/   │
│ uncheck items • ➕ Add item •   │
│ ✏️ Edit                         │
╰─────────────────────────────────╯
Reactions: 1️⃣ ➕ ✏️
```

### 5. Complete Shopping Experience
```
Final workflow:
1. 1️⃣ → Check milk (becomes ~~strikethrough~~)
2. 2️⃣ → Check bread (becomes ~~strikethrough~~)
3. 3️⃣ → Check eggs (becomes ~~strikethrough~~)
4. 🧹 → Clear all checked items at once!
5. Only unchecked items remain

If list becomes empty:
╭─────────────────────────────────╮
│ 🛒 Weekly Groceries             │
│                                 │
│ Your shopping list is empty.    │
│ Add some items with /shop add!  │
│                                 │
│ Use /shop add <item> to add     │
│ items to your list              │
╰─────────────────────────────────╯
```

## Key Features Demonstrated

### ✨ Simple One-Click System
- **Click number**: Check/uncheck item (becomes ~~strikethrough~~)
- **Click 🧹**: Clear all checked items at once
- No complex menus or multiple steps!

### 🎯 Intuitive Number System
- Each item gets a number emoji (1️⃣, 2️⃣, 3️⃣, etc.)
- Click the number to toggle that specific item
- Maximum 10 items supported with number emojis

### 📊 Clear Progress Tracking
- ✅ Checked items shown with strikethrough
- ⬜ Unchecked items shown normally
- Progress counter: "3/4 items checked"

### 🧹 Batch Operations
- 🧹 appears when there are checked items
- One click removes all checked items at once
- Perfect for clearing completed shopping

### 👥 Multi-User Support
- Actions show which user performed them
- Multiple people can check items simultaneously
- Perfect for family shopping or team coordination

### 🛠️ Additional Features
- ➕ Quick add items via reaction
- ✏️ Edit items in-place
- Channel management with `/shop channel`
- Help system with `/shop help`