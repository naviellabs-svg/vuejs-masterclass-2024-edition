# Masterclass 2024 Notes

## Lesson 8.100 - Fetch and Collect Collaborators Across All Projects

> **Purpose:** Create a reusable composable that efficiently fetches collaborator profiles for multiple projects/tasks in parallel, then groups them by item ID for easy lookup. This avoids making individual API calls for each project/task and provides a centralized way to access collaborator data.

### Overview

Instead of fetching collaborator profiles one-by-one for each project or task, we batch all the requests using `Promise.all()` and store the results in a reactive object keyed by item ID. This pattern is useful when displaying lists where each item needs associated user data.

---

### Step 1: Create the GroupedCollabs Type

**File:** `src/types/GroupedCollabs.ts`

> **Purpose:** Define a type that maps item IDs (project/task IDs) to their associated collaborator profiles.

#### Tasks

- [x] Create new file `src/types/GroupedCollabs.ts`
- [x] Import the `Collabs` type from `@/utils/supaQueries`
- [x] Define `GroupedCollabs` as an object with string keys (item IDs) and `Collabs` array values

```typescript
import type { Collabs } from '@/utils/supaQueries'

export type GroupedCollabs = {
  [key: string]: Collabs // Maps item ID → array of collaborator profiles
}
```

**Explanation:** This type represents a dictionary where:

- **Key:** The ID of a project or task (as a string)
- **Value:** An array of collaborator profile objects (username, avatar_url, id, full_name)

---

### Step 2: Update the Collabs Composable

**File:** `src/composables/collabs.ts`

> **Purpose:** Add state management and a function to batch-fetch and group collaborators for multiple items at once.

#### Tasks

- [x] Import the new `GroupedCollabs` type
- [x] Import `Projects` and `TasksWithProjects` types from `@/utils/supaQueries`
- [x] Create a reactive state `groupedCollabs` to store the grouped results
- [x] Create `getGroupedCollabs` function that:
  - Filters items that have collaborators
  - Maps each item to a promise that fetches its collaborators
  - Uses `Promise.all()` to fetch all in parallel
  - Stores results in `groupedCollabs` keyed by item ID
- [x] Return the new function and state from the composable

**Final Implementation:**

```typescript
import { groupedProfilesQuery } from '@/utils/supaQueries'
import type { GroupedCollabs } from '@/types/GroupedCollabs'
import type { Projects, TasksWithProjects } from '@/utils/supaQueries'

export const useCollabs = () => {
  // Reactive state: stores collaborators grouped by item ID
  const groupedCollabs = ref<GroupedCollabs>({})

  // Helper: fetch profiles for a single array of user IDs
  const getProfilesByIds = async (userIds: string[]) => {
    const { data, error } = await groupedProfilesQuery(userIds)
    if (error || !data) return []
    return data
  }

  // Main function: batch-fetch collaborators for all items
  const getGroupedCollabs = async (items: Projects | TasksWithProjects) => {
    // Step 1: Filter only items that have collaborators
    const filteredItems = items.filter((item) => item.collaborators.length)

    // Step 2: Create an array of promises (one per item)
    const promises = filteredItems.map((item) => getProfilesByIds(item.collaborators))

    // Step 3: Execute all requests in parallel
    const results = await Promise.all(promises)

    // Step 4: Store results in groupedCollabs, keyed by item ID
    filteredItems.forEach((item, index) => {
      groupedCollabs.value[item.id] = results[index] ?? []
    })
  }

  return {
    getProfilesByIds,
    getGroupedCollabs,
    groupedCollabs
  }
}
```

**Key Points:**

- **Why filter first?** We only process items with collaborators to avoid unnecessary API calls
- **Why `Promise.all()`?** Fetches all collaborator data in parallel instead of sequentially (much faster)
- **Why `?? []`?** Handles cases where a promise might return `undefined` (TypeScript safety)
- **Why store by ID?** Makes it easy to look up collaborators for a specific project/task: `groupedCollabs.value[projectId]`

---

### Step 3: Use in Projects Page

**File:** `src/pages/projects/index.vue`

> **Purpose:** Replace individual collaborator fetching with the new batch-fetching function.

#### Tasks

- [x] Import `getGroupedCollabs` and `groupedCollabs` from `useCollabs()`
- [x] Call `getGroupedCollabs()` with the projects data after fetching projects
- [x] The `groupedCollabs` reactive object is now available for use in the component

```typescript
const { getGroupedCollabs, groupedCollabs } = useCollabs()

await getProjects() // Fetch projects first
await getGroupedCollabs(projects.value) // Then fetch all collaborators

console.log('TEST :: ', groupedCollabs) // Check the grouped results
```

**Usage Example:**

```typescript
// Access collaborators for a specific project
const projectId = 'some-project-id'
const collaborators = groupedCollabs.value[projectId] // Array of collaborator profiles
```

---

### Notes / Learnings

#### Why This Pattern?

- **Performance:** `Promise.all()` fetches all collaborator data in parallel, reducing total wait time from `n × request_time` to just `request_time`
- **Reusability:** The composable can work with both `Projects` and `TasksWithProjects` types
- **State Management:** Centralized storage makes collaborator data accessible throughout the component lifecycle

#### Gotchas & Solutions

1. **Type Safety:** The `results[index] ?? []` pattern prevents TypeScript errors when a promise might return undefined
2. **Filtering:** Always filter items with collaborators first, otherwise you'll create empty promises
3. **Index Matching:** Using `filteredItems.forEach` ensures the index matches between filtered items and results array

#### When to Use This Pattern

- ✅ When you need to fetch related data for multiple items in a list
- ✅ When the related data comes from a different table/endpoint
- ✅ When you want to avoid N+1 query problems
- ❌ Don't use if you only need data for a single item (use `getProfilesByIds` directly)

#### Next Steps

- Use `groupedCollabs` in table columns to display collaborator avatars
- Consider adding error handling for failed requests
- Could add caching/memoization if collaborators don't change frequently

## Lesson 8.101 - Use Vue.js Render Functions to Render Collaborators

> **Purpose:** Convert the static table columns definition into a function that accepts collaborator data, then use Vue render functions to display collaborator avatars in the table cells. This allows the columns to access reactive collaborator data from the `groupedCollabs` composable.

### Overview

Instead of displaying raw collaborator IDs (which are just strings), we want to show actual user avatars. By converting `columns` from a static array to a function that receives the `groupedCollabs` reactive ref, we can access the full collaborator profile data (including avatar URLs) and render Avatar components using Vue's `h()` render function.

---

### Step 1: Convert Columns to a Function

**File:** `src/utils/tableColumns/projectsColumns.ts`

> **Purpose:** Transform the columns export from a static array to a function that accepts collaborator data as a parameter.

#### Tasks

- [x] Change `export const columns` from an array to a function that takes `collabs: Ref<GroupedCollabs>` as a parameter
- [x] Import `Ref` type from 'vue'
- [x] Import `GroupedCollabs` type
- [x] Import Avatar components (`Avatar`, `AvatarImage`)

**Implementation:**

```typescript
import type { ColumnDef } from '@tanstack/vue-table'
import type { Projects } from '../supaQueries'
import { RouterLink } from 'vue-router'
import type { Ref } from 'vue'
import type { GroupedCollabs } from '@/types/GroupedCollabs'
import Avatar from '@/components/ui/avatar/Avatar.vue'
import AvatarImage from '@/components/ui/avatar/AvatarImage.vue'

export const columns = (collabs: Ref<GroupedCollabs>): ColumnDef<Projects[0]>[] => [
  // ... existing columns ...
]
```

**Explanation:**

- The function signature `(collabs: Ref<GroupedCollabs>)` allows us to pass the reactive `groupedCollabs` ref
- The return type `ColumnDef<Projects[0]>[]` ensures type safety for the column definitions
- Using `Ref<GroupedCollabs>` instead of just `GroupedCollabs` allows the columns to stay reactive to changes

---

### Step 2: Update Collaborators Column to Use Render Functions

**File:** `src/utils/tableColumns/projectsColumns.ts`

> **Purpose:** Replace the JSON.stringify display with actual Avatar components rendered using Vue's `h()` function.

#### Tasks

- [x] Update the `collaborators` column's `cell` function to access collaborator data from `collabs.value[row.original.id]`
- [x] Use `.map()` to iterate over collaborators and create Avatar components
- [x] Use `h()` render function to create `Avatar` and `AvatarImage` components
- [x] Pass `avatar_url` from collaborator data to `AvatarImage`

**Implementation:**

```typescript
{
  accessorKey: 'collaborators',
  header: () => h('div', { class: 'text-left' }, 'Collaborators'),
  cell: ({ row }) => {
    // Get collaborators for this project from groupedCollabs
    const projectCollaborators = collabs.value[row.original.id]

    // If no collaborators, return empty div
    if (!projectCollaborators || projectCollaborators.length === 0) {
      return h('div', { class: 'text-left font-medium' }, '')
    }

    // Map each collaborator to an Avatar component
    return h(
      'div',
      { class: 'text-left font-medium flex gap-2' },
      projectCollaborators.map((collab) => {
        return h(
          Avatar,
          { class: 'border border-primary' },
          () => h(AvatarImage, { src: collab.avatar_url || '', alt: collab.username || '' })
        )
      })
    )
  }
}
```

**Key Points:**

- **`h()` function:** Vue's render function to create VNodes (Virtual DOM nodes) programmatically
- **Nested components:** Use arrow function `() => h(...)` as children when the child component needs props
- **Optional chaining:** `collabs.value[row.original.id]?.map()` safely handles missing collaborator data
- **Fallback values:** `collab.avatar_url || ''` provides empty string if avatar is null

---

### Step 3: Use the Function in Projects Page

**File:** `src/pages/projects/index.vue`

> **Purpose:** Call the columns function with the `groupedCollabs` ref and pass the result to the DataTable component.

#### Tasks

- [x] After fetching collaborators, create `columnsWithCollabs` by calling `columns(groupedCollabs)`
- [x] Pass `columnsWithCollabs` to the `DataTable` component's `:columns` prop

**Implementation:**

```typescript
const { getGroupedCollabs, groupedCollabs } = useCollabs()

await getProjects() // Fetch projects first
await getGroupedCollabs(projects.value) // Then fetch all collaborators

// Create columns with collaborator data
const columnsWithCollabs = columns(groupedCollabs)
```

```vue
<template>
  <DataTable v-if="projects" :columns="columnsWithCollabs" :data="projects" />
</template>
```

**Explanation:**

- The `columns()` function is called after `getGroupedCollabs()` completes, ensuring collaborator data is available
- The reactive `groupedCollabs` ref is passed to the function, so if collaborator data updates, the columns will reactively update
- The DataTable component receives the column definitions with embedded render functions

---

### Notes / Learnings

#### Why Use Render Functions?

- **Dynamic Content:** Render functions allow us to programmatically create components based on data
- **Performance:** Render functions are more efficient than template compilation for dynamic lists
- **Flexibility:** We can conditionally render different components based on data state
- **Type Safety:** TypeScript can better infer types in render functions compared to templates

#### Vue Render Function Syntax

```typescript
h(Component, Props, Children)
```

- **Component:** The component or HTML tag name
- **Props:** Object with component props/attributes
- **Children:** String, array of VNodes, or function that returns VNodes

**Examples:**

```typescript
// Simple element
h('div', { class: 'container' }, 'Hello')

// Component with props
h(Avatar, { class: 'border' }, () => h(AvatarImage, { src: 'url' }))

// Multiple children
h('div', {}, [h('span', {}, 'First'), h('span', {}, 'Second')])
```

#### Gotchas & Solutions

1. **Children as Functions:** When passing a component as a child that needs props, use an arrow function: `() => h(ChildComponent, { prop: value })`
2. **Reactivity:** The `collabs` ref must be passed to the function, not unwrapped, to maintain reactivity
3. **Null Safety:** Always check if collaborator data exists before mapping: `collabs.value[id]?.map(...)`
4. **Key Props:** When rendering lists in render functions, you may need to add keys manually (though TanStack Table handles this)

#### When to Use Render Functions vs Templates

- ✅ **Use render functions for:**
  - Dynamic component generation (like this case)
  - Complex conditional rendering
  - Programmatic component creation
  - When working with libraries that expect render functions (like TanStack Table)

- ❌ **Use templates for:**
  - Most standard UI rendering
  - When you need template syntax features (v-if, v-for, etc.)
  - When readability is more important than programmatic control

#### Next Steps

- Add `AvatarFallback` component for when avatar images fail to load
- Add hover tooltips showing collaborator names
- Make avatars clickable to navigate to user profiles
- Consider adding a "more collaborators" indicator when there are many collaborators

## Lesson 8.102 - Load Collaborators Without Blocking Page Render

> **Purpose:** Fire collaborator fetching in the background so the projects page renders immediately, while still displaying avatars once data arrives (or skeletons while loading).

### Overview

We stop awaiting `getGroupedCollabs` so the table renders as soon as projects load. The collaborators column now handles three states: data present (avatars), loading (skeleton avatars), and empty (nothing).

---

### Step 1: Trigger collaborator fetch without blocking

**File:** `src/pages/projects/index.vue`

> **Purpose:** Let the page render immediately; fetch collaborators asynchronously.

#### Tasks

- [x] Remove `await` when calling `getGroupedCollabs` so it runs in the background
- [x] Keep `columnsWithCollabs` derived from the reactive `groupedCollabs`

```typescript
await getProjects() // fetch projects first

const { getGroupedCollabs, groupedCollabs } = useCollabs()
getGroupedCollabs(projects.value) // no await → non-blocking

const columnsWithCollabs = columns(groupedCollabs)
```

---

### Step 2: Handle collaborators column states

**File:** `src/utils/tableColumns/projectsColumns.ts`

> **Purpose:** Render avatars when data exists; show skeletons while loading; stay safe when no data.

#### Tasks

- [x] Read collaborators from `collabs.value[row.original.id]`
- [x] If present: render avatars linking to user profiles
- [x] If missing (still loading): render placeholder/skeleton avatars
- [x] Use guard to avoid calling `.map` on `undefined`

```typescript
cell: ({ row }) => {
  const projectCollabs = collabs.value[row.original.id]

  if (!projectCollabs || projectCollabs.length === 0) {
    return h(
      'div',
      { class: 'text-left font-medium flex gap-2' },
      row.original.collaborators.map(() =>
        h(Avatar, { class: 'animate-pulse' }, () => h(AvatarFallback))
      )
    )
  }

  return h(
    'div',
    { class: 'text-left font-medium flex gap-2' },
    projectCollabs.map((collab) =>
      h(RouterLink, { to: `/users/${collab.username}` }, () =>
        h(Avatar, { class: 'hover:scale-110 transition-transform' }, () =>
          h(AvatarImage, { src: collab.avatar_url || '' })
        )
      )
    )
  )
}
```

**Key Points**

- Non-blocking fetch keeps initial render fast.
- Guarding `projectCollabs` prevents runtime errors when data isn’t loaded yet.
- Skeleton avatars give immediate visual feedback while loading.
- Avatars link to user profiles when data is available.

---

### Notes / Learnings

- Non-blocking async calls improve perceived performance.
- Always guard optional data before mapping to avoid `undefined` errors.
- Provide a loading state (skeletons) to avoid layout jumps while data arrives.
