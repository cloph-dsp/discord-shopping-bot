# Visual Example

Text mockups of what the bot posts in Discord. Embed colours and button styles are noted; everything else is the literal text.

Legend:

- Item buttons: `⬜` grey (unchecked), `✅` green (checked)
- `➕ Add`: blurple, `🧹 Clear Done`: red, `✏️ Edit` / `🔄 Refresh`: grey
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
│ *Use the buttons below to check off items    │
│ as you shop!*                                │
│                                              │
│ 🛒 0/4 items - Let's shop!      Today at 18:42│
└──────────────────────────────────────────────┘
[⬜ 1. milk] [⬜ 2. bread] [⬜ 3. eggs] [⬜ 4. apples]
[➕ Add] [✏️ Edit] [🔄 Refresh]
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
│ *Use the buttons below to check off items    │
│ as you shop!*                                │
│                                              │
│ 📝 1/4 items checked - Keep going!           │
└──────────────────────────────────────────────┘
[✅ 1. milk] [⬜ 2. bread] [⬜ 3. eggs] [⬜ 4. apples]
[➕ Add] [🧹 Clear Done] [✏️ Edit] [🔄 Refresh]
```

Embed colour: yellow. Button 1 is green. Clicking it again replies `⬜ Unchecked: **milk**` and restores the previous state.

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

The list message is re-rendered with six item buttons and footer `📝 1/6 items checked - Keep going!`.

## 4. Edit an item with the modal

Click `✏️ Edit`. The modal:

```
┌─ Edit Item — Weekly Groceries ───────────────┐
│ Item number (1-99)                           │
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

Ephemeral reply:

```
✏️ Updated "bread" → "wholemeal bread".
```

Button 2 now reads `⬜ 2. wholemeal bread`.

## 5. Clear completed items

Check `wholemeal bread` and `eggs`, then click `🧹 Clear Done`:

```
✅ Checked: **wholemeal bread**
✅ Checked: **eggs**
🧹 Cleared 3 completed items!
```

The three checked items are deleted. Remaining items are renumbered from 1:

```
┌─ Embed ──────────────────────────────────────┐
│ 🛒 Weekly Groceries                          │
│                                              │
│ *Use the buttons below to check off items    │
│ as you shop!*                                │
│                                              │
│ 🛒 0/3 items - Let's shop!                   │
└──────────────────────────────────────────────┘
[⬜ 1. apples] [⬜ 2. butter] [⬜ 3. cheese]
[➕ Add] [✏️ Edit] [🔄 Refresh]
```

Embed colour: blurple. `Clear Done` disappears again.

## 6. Finish the list

Check every item:

```
┌─ Embed ──────────────────────────────────────┐
│ 🛒 Weekly Groceries                          │
│                                              │
│ *Use the buttons below to check off items    │
│ as you shop!*                                │
│                                              │
│ ✨ All done! (3/3 items)                     │
└──────────────────────────────────────────────┘
[✅ 1. apples] [✅ 2. butter] [✅ 3. cheese]
[➕ Add] [🧹 Clear Done] [✏️ Edit] [🔄 Refresh]
```

Embed colour: green. Clicking `🧹 Clear Done` replies `🧹 Cleared 3 completed items!`.

## 7. Empty list

After clearing everything, or after `/shop clear`:

```
┌─ Embed ──────────────────────────────────────┐
│ 🛒 Weekly Groceries                          │
│                                              │
│ *Your shopping list is empty. Click the      │
│ "Add Items" button below to get started!*    │
│                                              │
│ ⬇️ Use the buttons below                     │
└──────────────────────────────────────────────┘
[➕ Add Items]
```

Embed colour: grey. An empty list shows only the Add button.

## 8. More than 20 items

Only the first 20 items get buttons; the rest appear in the embed. The description is capped at Discord's 4096-character limit, so very long lists end with an "and N more items" line.

```
┌─ Embed ──────────────────────────────────────┐
│ 🛒 Costco Run                                │
│                                              │
│ **First 20 items have buttons below.**       │
│                                              │
│ **Remaining items:**                         │
│ 21. ⬜ batteries                             │
│ 22. ✅ ~~paper towels~~                      │
│                                              │
│ 📝 1/22 items checked - Keep going!          │
└──────────────────────────────────────────────┘
[⬜ 1. water] [⬜ 2. rice] [⬜ 3. pasta] [⬜ 4. oil] [⬜ 5. salt]
... four item rows in total ...
[➕ Add] [🧹 Clear Done] [✏️ Edit] [🔄 Refresh]
```

Items 21+ have no buttons and cannot be toggled. Use `✏️ Edit` with the item number to change one; `/shop add` appends new items to the end.

## 9. Multiple lists

`/shop lists` (ephemeral):

```
📋 Available Shopping Lists (2)

🔹 Weekly Groceries (active here) - 0/3 complete
▫️ Hardware - 📝 Empty

💡 Use /shop list "ListName" to display a list in this channel.
```

`/shop list title: Hardware` (ephemeral):

```
✅ "Hardware" is now active in this channel!
```

Creating or displaying a list makes it the active list for the current channel; `/shop add` and `/shop clear` operate on that list.

## Notes

- There are no emoji reactions or two-step checks. Checking is a single button press that toggles the item.
- Every list interaction gets an ephemeral acknowledgement; the channel only sees the edited list message.
- The public list message is shared: any member who can see the channel can press its buttons.
- Re-rendering is in place, so message history does not fill with updated copies of the list.
