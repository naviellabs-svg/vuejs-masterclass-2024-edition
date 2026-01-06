# Masterclass 2024 Notes

## 8.100 - Fetch and Collect Collaborators Across All Projects

### collabs.ts
- [ ] Add the following code below return data
```
const getGroupedCollabs = async (items: Projects | TasksWithProjects) =>{


  }
```
- [ ] import type {Projects, TasksWithProjects} from '@/utils/supaQueries' 
- [ ] add 
```
const results = await Promise.all(promises)
```
- [ ] Create new state 
```export const useCollabs = () => {
const groupedCollabs = ref<>({})```
### types
- [ ] create GroupedCollabs.ts
- [ ] add code
```
import type { Collabs } from "@/utils/supaQueries"

export type GroupedCollabs = {
  [key: string]: Collabs
}
```

### collabs.ts
- [ ] add GroupedCollbas inside <> `const groupedCollabs = ref<GroupedCollabs>({})`
- [ ] update getGroupedCollabs to iterate over items after fetching collaborators
```
const getGroupedCollabs = async (items: Projects | TasksWithProjects) =>{
const promises = items
.filter((item) => item.collaborators.length)
.map((item) => getProfilesByIds(item.collaborators))

const results = await Promise.all(promises)

items.forEach((item,index) => {

})
```
- [ ] in getGroupedCollabs add new const a top and use in promises
```const filteredItems = items.filter((item) => item.collaborators.length)

    const promises = items
      .filter((item) => filteredItems.map((item) =>
        getProfilesByIds(item.collaborators)
    )```
    - [ ] use filterdItems instead of items 
    ```
    filteredItems.forEach((item, index) => {
    }
      ```
  - [ ] create new objcet inside .forEach
  ```
  filteredItems.forEach((item, index) => {
      groupedCollabs.value[item.id] = results[index]
    })
```
- [ ] now return 
```
return {
    getProfilesByIds,
    getGroupedCollabs,
    groupedCollabs,
  }
```

### projects/index.vue

- [ ] instead of getProfilesByIds use
```
const { getGroupedCollabs, groupedCollabs } = useCollabs()
```
- [ ] remove test and add await and conslole log 
```
await getGroupedCollabs(projects.value)

console.log('TEST :: ', groupedCollabs)
```
