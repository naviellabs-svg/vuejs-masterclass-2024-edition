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

## Lesson 8.103 - Reuse the Pinia Loader to Load Single Project

> **Purpose:** Centralize single project loading logic in the Pinia store, enabling caching and preventing redundant API calls. This improves performance by reusing cached project data when users navigate back to previously visited project pages.

### Overview

Instead of fetching project data directly in the component, we move the `getProject` function to the shared Pinia store. This allows us to:

- Cache project data using `useMemoize` (same pattern as `getProjects`)
- Reuse cached data when navigating back to a project
- Centralize error handling and state management
- Provide a consistent data loading pattern across the app

---

### Step 1: Add getProject to Projects Store

**File:** `src/stores/loaders/projects.ts`

> **Purpose:** Add a function to fetch a single project by slug, using the same caching pattern as `getProjects`.

#### Tasks

- [x] Create `loadProject` memoized function using `useMemoize`
- [x] Add `project` reactive state to store single project data
- [x] Create `getProject` function that accepts a `slug` parameter
- [x] Use `loadProject` instead of calling `projectQuery` directly
- [x] Add error handling and data validation
- [x] Export `getProject` and `project` from the store

**Implementation:**

```typescript
import { projectQuery, projectsQuery } from '@/utils/supaQueries'
import { useMemoize } from '@vueuse/core'
import type { Project, Projects } from '@/utils/supaQueries'

export const useProjectsStore = defineStore('projects-store', () => {
  const projects = ref<Projects>([])
  const project = ref<Project>()

  // Memoized loader for single project (caches by slug)
  const loadProject = useMemoize(async (slug: string) => await projectQuery(slug))

  // Memoized loader for all projects (cached by key)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const loadProjects = useMemoize(async (key: string) => await projectsQuery)

  // ... validateCache function ...

  const getProjects = async () => {
    const { data, error, status } = await loadProjects('projects')
    if (error) useErrorStore().setError({ error, customCode: status })
    if (data) projects.value = data
    validateCache()
  }

  // New function: fetch single project by slug
  const getProject = async (slug: string) => {
    const { data, error, status } = await loadProject(slug)

    if (error) useErrorStore().setError({ error, customCode: status })

    if (data) project.value = data
  }

  return {
    projects,
    getProjects,
    getProject, // Export new function
    project // Export new state
  }
})
```

**Key Points:**

- **`useMemoize`:** Caches the result based on the `slug` parameter, so subsequent calls with the same slug return cached data
- **Parameter:** `getProject` accepts `slug: string` instead of reading from route (better separation of concerns)
- **State Management:** `project` ref stores the single project, separate from the `projects` array
- **Error Handling:** Uses the same error store pattern as `getProjects` for consistency

---

### Step 2: Update Component to Use Store

**File:** `src/pages/projects/[slug].vue`

> **Purpose:** Remove local state and use the centralized store function instead.

#### Tasks

- [x] Remove local `project` state declaration
- [x] Import and use `useProjectsStore`
- [x] Extract `project` from store using `storeToRefs`
- [x] Extract `getProject` function from store
- [x] Get `slug` from route params
- [x] Call `getProject(slug)` instead of local function
- [x] Keep the watch for updating page title

**Implementation:**

```typescript
<script setup lang="ts">
const { slug } = useRoute('/projects/[slug]').params

const projectsLoader = useProjectsStore()
const { project } = storeToRefs(projectsLoader)
const { getProject } = projectsLoader

// Watch for project name changes to update page title
watch(
  () => project.value?.name,
  () => {
    usePageStore().pageData.title = `Project: ${project.value?.name || ''}`
  }
)

// Fetch project using store function
await getProject(slug)
</script>
```

**Before (Local State):**

```typescript
const project = ref<Project | null>(null)

const getProject = async () => {
  const { data, error, status } = await projectQuery(route.params.slug)
  if (error) useErrorStore().setError({ error, customCode: status })
  project.value = data
}
```

**After (Store):**

```typescript
const { project } = storeToRefs(projectsLoader)
const { getProject } = projectsLoader
await getProject(slug)
```

**Benefits:**

- **Caching:** If user navigates away and comes back, project data is cached
- **Consistency:** Same pattern as `getProjects` for easier maintenance
- **Separation:** Component focuses on UI, store handles data logic

---

### Step 3: Prevent Layout Shift in Table Columns

**File:** `src/utils/tableColumns/projectsColumns.ts`

> **Purpose:** Add fixed height to collaborator column to prevent layout shift when avatars load.

#### Tasks

- [x] Add `h-20` class to set fixed height
- [x] Add `flex items-center` to vertically center avatars
- [x] Maintain existing styling for text alignment

**Implementation:**

```typescript
{
  accessorKey: 'collaborators',
  header: () => h('div', { class: 'text-left' }, 'Collaborators'),
  cell: ({ row }) => {
    const projectCollabs = collabs.value[row.original.id]

    return h(
      'div',
      { class: 'text-left font-medium h-20 flex items-center' }, // Fixed height + flex centering
      // ... rest of the code
    )
  }
}
```

**Explanation:**

- **`h-20`:** Sets a fixed height (5rem/80px) preventing the row from jumping when avatars load
- **`flex items-center`:** Vertically centers the avatars within the fixed height
- **Why it matters:** Without fixed height, rows expand when images load, causing jarring layout shifts

---

### Notes / Learnings

#### Why Centralize in Store?

- **Caching:** `useMemoize` automatically caches results by slug, preventing redundant API calls
- **State Persistence:** Project data persists across route navigation (until cache is cleared)
- **Consistency:** Same pattern for both list and detail views makes code easier to understand
- **Performance:** Users get instant page loads when revisiting projects they've already viewed

#### How useMemoize Works

```typescript
const loadProject = useMemoize(async (slug: string) => await projectQuery(slug))
```

- **First call:** `getProject('my-project')` → Fetches from API, caches result
- **Second call:** `getProject('my-project')` → Returns cached result immediately
- **Different slug:** `getProject('other-project')` → Fetches new data, caches separately
- **Cache key:** The `slug` parameter acts as the cache key

#### Gotchas & Solutions

1. **Route Params:** Extract `slug` from route params in component, don't access `route` in store (better separation)
2. **Type Safety:** `project` is `ref<Project>()` (not nullable) because we only set it when data exists
3. **Cache Invalidation:** Currently cache persists indefinitely; could add manual invalidation if needed
4. **Layout Shift:** Fixed height (`h-20`) prevents rows jumping when images load asynchronously

#### When to Use This Pattern

- ✅ **Use store loading for:**
  - Data that might be accessed multiple times
  - Data that benefits from caching
  - Data shared across multiple components
  - When you want consistent error handling

- ❌ **Keep local state for:**
  - Truly one-time, component-specific data
  - Form data that shouldn't persist
  - UI-only state (modals, dropdowns, etc.)

#### Next Steps

- Add cache invalidation when project is updated
- Consider adding loading states for better UX
- Could add optimistic updates for faster perceived performance
- Might want to add cache expiration/TTL for stale data

## Lesson 8.104 - Make Pinia Loader Cache Invalidation Reusable

> **Purpose:** Extract the “stale-while-revalidate” cache validation into a reusable function that works for both **list queries** (projects) and **single-item queries** (project by slug).

### Overview

We already use `useMemoize` to cache loader calls. In this lesson we make the **cache invalidation / revalidation** logic reusable by parameterizing `validateCache` with:

- The reactive ref that holds cached data (`projects` or `project`)
- The underlying query (`projectsQuery` or `projectQuery(slug)`)
- The cache key used by the memoized loader
- The memoized loader function so we can delete the key when data changes

This gives us a simple SWR flow:

- **Return cached data immediately** (fast UI)
- **Revalidate in the background**
- **If fresh data differs**, clear memoize cache and update the ref

---

### Step 1: Make store state nullable

**File:** `src/stores/loaders/projects.ts`

> **Purpose:** Support “not loaded yet” state and allow truthy checks inside `validateCache`.

#### Tasks

- [x] Set initial values to `null`

```typescript
const projects = ref<Projects | null>(null)
const project = ref<Project | null>(null)
```

---

### Step 2: Create a reusable `validateCache` helper

**File:** `src/stores/loaders/projects.ts`

> **Purpose:** One function that can validate and invalidate cache for both projects list and single project.

#### Tasks

- [x] Create `ValidateCacheParams` interface
- [x] Accept `ref`, `query`, `key`, and `loaderFn`
- [x] If we have cached data (`ref.value`), run the “fresh” query in the background
- [x] If cached vs fresh differs, delete memoized cache key and update the ref

```typescript
interface ValidateCacheParams {
  ref: typeof projects | typeof project
  query: typeof projectsQuery | typeof projectQuery
  key: string
  loaderFn: typeof loadProjects | typeof loadProject
}

const validateCache = ({ ref, query, key, loaderFn }: ValidateCacheParams) => {
  if (!ref.value) return

  const finalQuery = typeof query === 'function' ? query(key) : query

  finalQuery.then(({ data, error }) => {
    // If data matches what we already have, do nothing
    if (JSON.stringify(ref.value) === JSON.stringify(data)) return

    // If data changed, invalidate memoized cache and update state
    loaderFn.delete(key)
    if (!error && data) ref.value = data
  })
}
```

**Note:** The important comparison is **`ref.value` vs fresh `data`** (so it works for both list + single item).

---

### Step 3: Call validateCache for both list + detail loaders

**File:** `src/stores/loaders/projects.ts`

> **Purpose:** Apply the same cache validation pattern in `getProjects` and `getProject`.

#### Tasks

- [x] After `getProjects`, validate projects cache
- [x] After `getProject(slug)`, validate that slug’s project cache

```typescript
validateCache({
  ref: projects,
  query: projectsQuery,
  key: 'projects',
  loaderFn: loadProjects
})

validateCache({
  ref: project,
  query: projectQuery,
  key: slug,
  loaderFn: loadProject
})
```

---

### Step 4: Make callers safe when data is nullable

**File:** `src/pages/projects/index.vue`

> **Purpose:** Avoid passing `null` into logic that expects an array.

#### Tasks

- [x] Use nullish coalescing when calling collaborators loader

```typescript
getGroupedCollabs(projects.value ?? [])
```

---

### Notes / Learnings

- **Why this approach:** You get “fast from cache” + “fresh from server” without duplicating logic for every loader.
- **Gotcha (types):** Once state is nullable, callers must handle `null` (`projects.value ?? []`).
- **Gotcha (comparison):** Compare `ref.value` to `data` (not `projects.value`), otherwise the helper won’t work for single project.
- **Potential improvement:** `JSON.stringify` comparisons can be expensive on large payloads; consider comparing a `updated_at` field or using a hash/version.

## Lesson 8.105 - Fix a Little Bug with the Project Title Watcher

> **Purpose:** Fix a bug where the page title watcher doesn't update when navigating between projects. By resetting the ref to `null` before fetching new data, we ensure the watcher detects the change and updates the title correctly.

### Overview

When navigating from one project to another, the watcher in `projects/[slug].vue` watches `project.value?.name` to update the page title. However, if the old project data persists in the ref, the watcher might not fire because the value hasn't changed (it's still the previous project's name). By resetting `project.value = null` at the start of `getProject()`, we ensure the watcher detects the transition from `null` → new project name.

**The Bug:**

- User navigates from Project A → Project B
- Old Project A data remains in `project.value`
- Watcher doesn't fire because `project.value?.name` hasn't changed
- Page title shows "Project: Project A" instead of "Project: Project B"

**The Fix:**

- Reset `project.value = null` before fetching
- Watcher detects change: `null` → `"Project B"`
- Page title updates correctly

---

### Step 1: Reset Project Ref Before Fetching

**File:** `src/stores/loaders/projects.ts`

> **Purpose:** Clear the project ref at the start of `getProject()` to ensure watchers detect the change when new data loads.

#### Tasks

- [x] Set `project.value = null` at the start of `getProject()` function
- [x] Also set `projects.value = null` at the start of `getProjects()` for consistency

**Implementation:**

```typescript
const getProjects = async () => {
  projects.value = null // Reset before fetching

  const { data, error, status } = await loadProjects('projects')

  if (error) useErrorStore().setError({ error, customCode: status })

  if (data) projects.value = data

  validateCache({
    ref: projects,
    query: projectsQuery,
    key: 'projects',
    loaderFn: loadProjects
  })
}

const getProject = async (slug: string) => {
  project.value = null // Reset before fetching - fixes watcher bug

  const { data, error, status } = await loadProject(slug)

  if (error) useErrorStore().setError({ error, customCode: status })

  if (data) project.value = data

  validateCache({
    ref: project,
    query: projectQuery,
    key: slug,
    loaderFn: loadProject
  })
}
```

**Key Points:**

- **Why reset to `null`?** Ensures watchers detect a change when new data loads
- **When does it happen?** At the very start of the function, before any async operations
- **What about caching?** The `useMemoize` cache still works - this just clears the reactive ref temporarily
- **Why both functions?** Consistency - both `getProjects` and `getProject` follow the same pattern

---

### How the Watcher Works

**File:** `src/pages/projects/[slug].vue`

The watcher in the component watches for changes to `project.value?.name`:

```typescript
watch(
  () => project.value?.name,
  () => {
    usePageStore().pageData.title = `Project: ${project.value?.name || ''}`
  }
)
```

**Without the fix:**

1. User on Project A: `project.value.name = "Project A"` ✅
2. Navigate to Project B: `getProject('project-b')` called
3. Old data persists: `project.value.name` still `"Project A"` ❌
4. New data loads: `project.value.name = "Project B"`
5. **Problem:** If Project A and B have similar names or the ref doesn't fully clear, watcher might not fire

**With the fix:**

1. User on Project A: `project.value.name = "Project A"` ✅
2. Navigate to Project B: `getProject('project-b')` called
3. **Reset:** `project.value = null` → watcher fires with `undefined` ✅
4. New data loads: `project.value.name = "Project B"` → watcher fires again ✅
5. **Result:** Page title updates correctly every time

---

### Notes / Learnings

#### Why This Pattern Works

- **Reactive Detection:** Vue's reactivity system detects the change from `null` → data
- **Watcher Fires:** The watcher callback runs when `project.value?.name` changes from `undefined` → new name
- **Clean State:** Resetting ensures we start with a clean slate, avoiding stale data issues
- **User Experience:** Page title updates immediately when new project loads

#### Gotchas & Solutions

1. **Timing:** Reset happens **before** the async fetch, not after - this ensures watchers fire correctly
2. **Null Safety:** Components using `project.value` should check for `null` (e.g., `v-if="project"`)
3. **Cache vs Ref:** The `useMemoize` cache is separate from the ref - cache persists, ref is cleared
4. **Multiple Watchers:** Any watcher watching `project.value` or its properties will fire when reset

#### When to Use This Pattern

- ✅ **Use reset pattern when:**
  - You have watchers that depend on the data
  - You want to ensure clean state transitions
  - You're navigating between similar items (projects, users, etc.)
  - You need to trigger side effects on data changes

- ❌ **Don't reset when:**
  - You want to show loading states (keep old data visible)
  - The data is expensive to re-render
  - You're doing optimistic updates

#### Alternative Approaches

1. **Watch with `immediate: true`:** Could watch the route param instead of the data
2. **Manual title update:** Set title directly in `getProject()` instead of using watcher
3. **Computed property:** Use computed for title instead of watcher

The reset approach is simplest and ensures watchers always fire correctly.

#### Next Steps

- Consider adding loading states while `project.value === null`
- Could add a transition effect when project data changes
- Might want to preserve some data (like tasks) during navigation for smoother UX

## Lesson 8.106 - Create Text Field Component with defineModel

> **Purpose:** Create a reusable in-place editing component using Vue 3's `defineModel` macro. This simplifies two-way data binding by automatically handling props and emits, making it easier to create editable text fields that can be used throughout the application.

### Overview

Vue 3.3+ introduced the `defineModel` macro, which simplifies creating components with two-way data binding. Instead of manually defining `modelValue` prop and `update:modelValue` emit, `defineModel` handles both automatically. This lesson creates an `AppInPlaceEditText` component that provides a clean, editable input field with custom styling for in-place editing.

**Benefits of `defineModel`:**

- **Simpler syntax:** No need to manually define props and emits
- **Less boilerplate:** Automatically handles `v-model` binding
- **Type-safe:** Works seamlessly with TypeScript
- **Reusable:** Can be used anywhere you need editable text

---

### Step 1: Create the In-Place Edit Component

**File:** `src/components/AppInPlaceEdit/AppInPlaceEditText.vue`

> **Purpose:** Create a reusable text input component that supports two-way data binding using `defineModel`.

#### Tasks

- [x] Create new component file `AppInPlaceEditText.vue`
- [x] Use `defineModel()` to create a reactive model value
- [x] Create an input element with `v-model` bound to the model
- [x] Add styling classes for in-place editing appearance

**Implementation:**

```vue
<script setup lang="ts">
const value = defineModel<string>()
</script>

<template>
  <input
    v-model="value"
    class="w-full p-1 bg-transparent focus:outline-none focus:border-none focus:bg-gray-800 focus:rounded-md"
    type="text"
  />
</template>
```

**Key Points:**

- **`defineModel<string>()`:** Creates a reactive ref that automatically handles `modelValue` prop and `update:modelValue` emit
- **Type parameter:** `<string>` specifies the type of the model value
- **Styling:** Classes provide a clean, minimal appearance that highlights on focus
- **No manual emits:** `defineModel` automatically emits updates when the value changes

**What `defineModel` does under the hood:**

```typescript
// defineModel() is equivalent to:
const props = defineProps<{ modelValue: string }>()
const emits = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

const value = computed({
  get: () => props.modelValue,
  set: (val) => emits('update:modelValue', val)
})
```

---

### Step 2: Use Component in Project Page

**File:** `src/pages/projects/[slug].vue`

> **Purpose:** Replace static text display with the editable component, allowing users to edit project names in place.

#### Tasks

- [x] Import or use `AppInPlaceEditText` component (auto-imported if configured)
- [x] Replace static `{{ project.name }}` with `<AppInPlaceEditText />`
- [x] Bind `v-model` to `project.name` for two-way data binding

**Implementation:**

```vue
<template>
  <Table v-if="project">
    <TableRow>
      <TableHead> Name </TableHead>
      <TableCell>
        <AppInPlaceEditText v-model="project.name" />
      </TableCell>
    </TableRow>
    <!-- ... rest of table ... -->
  </Table>
</template>
```

**Before (Static):**

```vue
<TableCell>
  {{ project.name }}
</TableCell>
```

**After (Editable):**

```vue
<TableCell>
  <AppInPlaceEditText v-model="project.name" />
</TableCell>
```

**Benefits:**

- **Immediate editing:** Users can click and edit directly in the table
- **Reactive updates:** Changes to `project.name` are immediately reflected
- **Clean UI:** Styling provides visual feedback on focus without cluttering the interface

---

### Notes / Learnings

#### Why Use `defineModel`?

- **Less Code:** Eliminates the need for manual prop/emit definitions
- **Type Safety:** TypeScript support is built-in and automatic
- **Convention:** Follows Vue 3.3+ best practices for two-way binding
- **Readability:** Makes component code cleaner and easier to understand

#### How `defineModel` Works

```typescript
// Simple usage
const value = defineModel<string>()

// With default value
const value = defineModel<string>({ default: '' })

// With modifiers (like .trim, .number)
const value = defineModel<string>('value', { trim: true })
```

**What it provides:**

- A reactive ref that can be used with `v-model`
- Automatic prop definition (`modelValue`)
- Automatic emit definition (`update:modelValue`)
- Full TypeScript support

#### Gotchas & Solutions

1. **Type Required:** Always specify the type parameter: `defineModel<string>()` not just `defineModel()`
2. **Default Values:** Use the options object for defaults: `defineModel<string>({ default: '' })`
3. **Multiple Models:** You can use `defineModel` multiple times with different names:
   ```typescript
   const title = defineModel<string>('title')
   const description = defineModel<string>('description')
   ```
4. **Reactivity:** The model value is automatically reactive - no need for `ref()` or `computed()`

#### When to Use `defineModel` vs Manual Props/Emits

- ✅ **Use `defineModel` when:**
  - Creating components that need simple two-way binding
  - Building reusable form components
  - You want cleaner, more maintainable code
  - Working with Vue 3.3+

- ❌ **Use manual props/emits when:**
  - You need complex validation logic
  - You need to transform values before emitting
  - Working with Vue 3.2 or earlier (no `defineModel` support)
  - You need multiple v-model bindings with custom names

#### Component Styling Explained

```css
w-full                    /* Full width */
p-1                       /* Small padding */
bg-transparent            /* Transparent background */
focus:outline-none        /* Remove default focus outline */
focus:border-none         /* Remove border on focus */
focus:bg-gray-800         /* Dark background on focus */
focus:rounded-md         /* Rounded corners on focus */
```

This creates a "ghost" input that only shows styling when focused, perfect for in-place editing.

#### Next Steps

- Add validation to prevent empty values
- Add save/cancel buttons for explicit save actions
- Add loading states when saving to database
- Create similar components for other input types (textarea, number, etc.)
- Add keyboard shortcuts (Enter to save, Escape to cancel)

## lesson 8.107

### AppInPlaceEditText.vue

craete emit to parent when user focus away to store project name in databse.

- [ ] crate emit when blur `<script setup lang="ts">

  const value = defineModel()

  defineEmits(['commit'])
  </script>
  <template>
  <input
  class="w-full p-1 bg-transparent focus:outline-none focus:border-none focus:bg-gray-800 focus:rounded-md"
  type="text"
  v-model="value"
  @blur="$emit('commit')"
  @keypress.enter="($event.target as HTMLInputElement).blur()"
  />
  </template>`

### projecrs/slug.vue

- [ ] add @commiy in parent `<AppInPlaceEditText
      v-model="project.name"
      @commit="console.log('changed')"`

## Lesson - 8.108 - Update Project Title in the Database

### projects.ts

- [ ] crate new function and return `const updateProject = async() => {


  }

  return {
    projects,
    getProjects,
    getProject,
    project,
    updateProject
  }
})`

### projects/slug.vue

- [ ]  destruct updateproject from projesctloader `const { getProject, upadteProject } = projectsLoader`
- [ ] use it instead of console.log `<TableCell>
        <AppInPlaceEditText
        v-model="project.name"
        @commit="updateProject"
        />
      </TableCell>`

### supaqueries.ts 
- [ ] add new query `export const updateProjectQuery = (updatedProject = {}, id: number) => {
  return supabase.from('projects').update(updatedProject).eq('id', id)
}`

### projects.ts
- [ ] `const updateProject = async() => {
  if(!project.value) return

  const {tasks, id,   ...projectProperties} = project.value

  await updateProjectQuery(projectProperties, project.value.id)

  }`