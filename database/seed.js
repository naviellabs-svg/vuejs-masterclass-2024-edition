/* eslint-env node */

import { faker } from '@faker-js/faker'
import { createClient } from '@supabase/supabase-js'

// Create a single supabase client for interacting with your database
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const seedProjects = async () => {

  const name = faker.lorem.words(3)

  await supabase.from('projects').insert({
    name: name,
    slug: name.toLocaleLowerCase().replace(/ /g, '-'),
    status: faker.helpers.arrayElement(['in-progress', 'completed']),
    collaborators: faker.helpers.arrayElements([1,2,3])
})
}
await seedProjects()
