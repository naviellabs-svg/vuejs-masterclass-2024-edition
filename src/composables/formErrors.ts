import type { LoginForm } from '@/types/AuthForm'
import type { AuthError } from '@supabase/supabase-js'

export const useFormerrors = () => {
  const serverError = ref('')
  const realtimeErrors = ref()

  const handelServerError = (error: AuthError) => {
    serverError.value =
      error.message === 'Invalid login credentials' ? 'Incorrect email or password' : error.message
  }

  const handelLoginForm = async (formData: LoginForm) => {
    realtimeErrors.value = {
      email: [],
      password: []
    }

    const { validateEmail, validatePassword } = await import('@/utils/formValidations')

    const emailErrors = validateEmail(formData.email)
    if(emailErrors.length) realtimeErrors.value.email = emailErrors

    const passwordErrors = validatePassword(formData.password)
    if(passwordErrors.length) realtimeErrors.value.password = passwordErrors
  }

  return {
    serverError,
    handelServerError,
    realtimeErrors,
    handelLoginForm
  }
}
