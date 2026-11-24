# Visual Example

Text mockups of what the bot posts in Discord. Embed colours and button styles are noted; everything else is the literal text.

Legend:

- Item buttons: `⬜` grey (unchecked), `✅` green (checked)
- Controls: `➕ Add` blurple, `🧹 Clear Done` red, `✏️ Edit` / `🗑️ Remove` / `🔄 Refresh` / `◀` / `▶` grey
- `/shop` replies are ephemeral and visible only to the person who ran the command

## 1. Create a list

```
/shop create title: Weekly Groceries items: milk;bread;eggs;apples
```

Ephemeral reply:

```
✅ Created shopping list "Weekly Groceries" with 4 items! This list is now active in this channel.
```

Public message:

```
┌─ Embed ──────────────────────────────────────┐
│ 🛒 Weekly Groceries                          │
│                                              │
│ ░░░░░░░░░░ **0%** · 0/4 checked              │
│                                              │
│ 1. ⬜ milk                                   │
│ 2. ⬜ bread                                  │
│ 3. ⬜ eggs                                   │
│ 4. ⬜ apples                                 │
│                                              │
│ 🛒 0/4 items - Let's shop!                   │
└──────────────────────────────────────────────┘
[⬜ 1. milk] [⬜ 2. bread] [⬜ 3. eggs] [⬜ 4. apples]
[➕ Add] [✏️ Edit] [🗑️ Remove] [🔄 Refresh]
```

Embed colour: blurple. `Clear Done` is absent because nothing is checked.

## 2. Check an item

Click `⬜ 1. milk`. Ephemeral reply:

```
✅ Checked: **milk**
```

The public message is edited in place:

```
┌─ Embed ──────────────────────────────────────┐
│ 🛒 Weekly Groceries                          │
│                                              │
│ ██░░░░░░░░ **25%** · 1/4 checked             │
│                                              │
│ 1. ✅ ~~milk~~                               │
│ 2. ⬜ bread                                  │
│ 3. ⬜ eggs                                   │
│ 4. ⬜ apples                                 │
│                                              │
│ 📝 1/4 items checked - Keep going!           │
└──────────────────────────────────────────────┘
[✅ 1. milk] [⬜ 2. bread] [⬜ 3. eggs] [⬜ 4. apples]
[➕ Add] [✏️ Edit] [🗑️ Remove] [🧹 Clear Done] [🔄 Refresh]
```

Embed colour: yellow. Button 1 is green. Clicking it again replies `⬜ Unchecked: **milk**`.

## 3. Add items with the modal

Click `➕ Add`. The modal:

```
┌─ Add Items — Weekly Groceries ───────────────┐
│ Items (use ; to separate)                    │
│ ┌──────────────────────────────────────────┐ │
│ │ butter;cheese                            │ │
│ └──────────────────────────────────────────┘ │
│                                    [Submit]  │
└──────────────────────────────────────────────┘
```

Ephemeral reply after submitting:

```
➕ Added 2 items to the shopping list:
• butter
• cheese
```

`/shop add "milk" 2` stores the quantity on the item; its button and embed line read `milk ×2`.

## 4. Edit or remove an item

Click `✏️ Edit`. The modal asks for a global item number and the new text:

```
┌─ Edit Item — Weekly Groceries ───────────────┐
│ Item number to edit                          │
│ ┌─────┐                                      │
│ │ 2   │                                      │
│ └─────┘                                      │
│ New item text                                │
│ ┌──────────────────────────────────────────┐ │
│ │ wholemeal bread                          │ │
│ └──────────────────────────────────────────┘ │
│                                    [Submit]  │
└──────────────────────────────────────────────┘
```

Reply: `✏️ Updated "bread" → "wholemeal bread".`

`🗑️ Remove` opens the same style of modal with one field, `Item number to remove`. Reply: `🗑️ Removed "bread".`

## 5. Clear completed items

Check `wholemeal bread` and `eggs`, then click `🧹 Clear Done`:

```
✅ Checked: **wholemeal bread**
✅ Checked: **eggs**
🧹 Cleared 3 completed items!
```

The checked items are deleted. Remaining items keep their order and are renumbered from 1.

## 6. Finish the list

With all items checked, the embed turns green and the bar fills:

```
│ ██████████ **100%** · 3/3 checked            │
│ ✨ All done! (3/3 items)                     │
```

## 7. Empty list

After clearing everything, or after `/shop clear`:

```
┌─ Embed ──────────────────────────────────────┐
│ 🛒 Weekly Groceries                          │
│                                              │
│ *Your shopping list is empty. Press ➕ Add    │
│ to get started!*                             │
│                                              │
│ ⬇️ Use the buttons below                     │
└──────────────────────────────────────────────┘
[➕ Add Items]
```

Embed colour: grey. An empty list shows only the Add button.

## 8. Pagination

A page holds 15 items. Longer lists get a navigation row:

```
┌─ Embed ──────────────────────────────────────┐
│ 🛒 Costco Run                                │
│                                              │
│ ██░░░░░░░░ **20%** · 4/20 checked            │
│                                              │
│ 16. ✅ ~~paper towels~~                      │
│ 17. ⬜ batteries                             │
│ ...                                          │
│                                              │
│ 📝 4/20 items checked - Keep going!          │
└──────────────────────────────────────────────┘
[item buttons 16–20 ...]
[➕ Add] [✏️ Edit] [🗑️ Remove] [🧹 Clear Done] [🔄 Refresh]
[◀ Previous] [2/2] [▶ Next]
```

Item numbers are global: `✏️ Edit` and `🗑️ Remove` accept any number, regardless of the current page. Every item has a button on exactly one page.

## 9. Sort and delete

`/shop sort` replies `🔤 Sorted 20 items in "Costco Run".`, puts items in alphabetical order and returns to page 1.

`/shop delete title: Costco Run` asks for confirmation:

```
⚠️ Delete "Costco Run" (20 items)? This cannot be undone.
[🗑️ Delete] [Cancel]
```

`Cancel` replies `❌ Delete cancelled.`; `Delete` removes the list and its public message.

## 10. Multiple lists

`/shop lists` (ephemeral):

```
📋 Available Shopping Lists (2)

🔹 **Weekly Groceries** (active here) - 0/3 complete
▫️ Hardware - 📝 Empty

💡 Use `/shop list "ListName"` to display a list in this channel.
```

Creating or displaying a list makes it the active list for the current channel; `/shop add`, `/shop clear` and `/shop sort` operate on that list.

## Notes

- There are no emoji reactions or two-step checks. Checking is a single button press that toggles the item.
- Every list interaction gets an ephemeral acknowledgement; the channel only sees the edited list message.
- The public list message is shared: any member who can see the channel can press its buttons.
- Re-rendering is in place, so message history does not fill with updated copies of the list.
