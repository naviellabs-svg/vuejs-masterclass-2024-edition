import type { AuthError } from "@supabase/supabase-js"

export const useFormerrors = () => {
  const serverError = ref('')


  const handelServerError = (error: AuthError) => {
    serverError.value =
    error.message === 'Invalid login credentials' ? 'Incorrect email or password' : error.message
  }

  return {
    serverError,
    handelServerError,
  }
}
