import { z } from 'zod'

export const UserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(24),
  token: z.string(),
})
export type User = z.infer<typeof UserSchema>

export const LoginFormSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(24),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
export type LoginFormValues = z.infer<typeof LoginFormSchema>

export const RegisterFormSchema = z
  .object({
    username: z.string().min(3, 'Username must be at least 3 characters').max(24),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
export type RegisterFormValues = z.infer<typeof RegisterFormSchema>
