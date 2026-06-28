# Architecture — Cross-Stack Type Safety

## Principle

**Zod schemas are the single source of truth.** Every input shape, validation rule, and TypeScript type is defined once in `packages/shared/` and consumed by both the NestJS API and the React Native app. No manual type duplication, no drift between frontend and backend.

## Monorepo Structure

```
nabhya/
  packages/
    shared/               ← Zod schemas + inferred types (shared between apps)
      src/
        auth.schema.ts    ← signInSchema, signUpSchema
        onboarding/       ← step schemas for onboarding flow
          index.ts
          step-1.schema.ts
          step-2.schema.ts
        user.schema.ts
        common/           ← reusable primitives (email, password, etc.)
          index.ts
    tsconfig.json
    package.json

  apps/
    native/               ← React Native (Expo SDK 56)
      src/
        components/ui/    ← Button, Input, Label, etc. (design-system-aware)
        hooks/use-auth.ts ← TanStack Query mutations (accept typed inputs)
        app/(auth)/       ← login.tsx, signup.tsx (use react-hook-form)
    api/                  ← NestJS (to be created)
      src/
        auth/
          auth.controller.ts
          auth.service.ts
```

## The Flow

### 1. Define a schema once in `packages/shared`

```ts
// packages/shared/src/auth.schema.ts
import { z } from "zod";

export const signUpSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(2).max(64).optional(),
});

// Inferred types — no manual type writing
export type SignUpInput = z.infer<typeof signUpSchema>;
// → { email: string; password: string; name?: string }

export type SignUpResponse = {
  user: { id: string; email: string; name?: string };
  tokens: { accessToken: string; refreshToken?: string };
};
```

### 2. NestJS validates with the same schema

```ts
// apps/api/src/common/pipes/zod-validation.pipe.ts
import { PipeTransform, BadRequestException } from "@nestjs/common";
import { ZodSchema } from "zod";

export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return result.data;
  }
}
```

Usage in controller:

```ts
@Post("auth/signup")
async signUp(@Body(new ZodValidationPipe(signUpSchema)) input: SignUpInput) {
  return this.authService.signUp(input);
}
```

**The backend never re-declares validation logic.** It imports the schema from `@nabhya/shared` and passes it to the pipe. Any change to the schema automatically updates both client validation and server validation.

### 3. RN validates the same way with react-hook-form

```tsx
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signUpSchema, type SignUpInput } from "@nabhya/shared";

function SignUpForm() {
  const { control, handleSubmit, formState: { errors } } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
  });

  const signUp = useSignUp(); // TanStack Query mutation

  return (
    <View>
      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <>
            <Label>Email</Label>
            <Input
              placeholder="you@example.com"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
            />
            {errors.email && <Caption color="error">{errors.email.message}</Caption>}
          </>
        )}
      />
      <Button onPress={handleSubmit((data) => signUp.mutate(data))}>
        Create account
      </Button>
    </View>
  );
}
```

**Key advantage:** the `resolver: zodResolver(signUpSchema)` gives you client-side validation *from the same schema file*. Field errors show inline before the user submits. On submit, the data shape already matches what the API expects.

## Onboarding Flow

Each onboarding step gets its own schema in `packages/shared/src/onboarding/`:

```ts
// packages/shared/src/onboarding/step-1.schema.ts
export const onboardingStep1Schema = z.object({
  displayName: z.string().min(2).max(50),
  avatarUrl: z.string().url().optional(),
});

// packages/shared/src/onboarding/step-2.schema.ts
export const onboardingStep2Schema = z.object({
  interests: z.array(z.string()).min(1).max(10),
});

// Combined full schema (optional, for summary/submit)
export const onboardingSchema = onboardingStep1Schema
  .merge(onboardingStep2Schema);
```

The RN app:

- Each onboarding screen uses `react-hook-form` with its step's schema
- On "Next", it calls a tRPC/NestJS mutation to save progress
- The backend stores the current step so the user can resume on re-open
- TanStack Query caches the onboarding status

## Current State & Migration Path

### Already done (RN app)

- `packages/shared/` — **not yet created** (this is the next task)
- UI components (`Button`, `Input`, `Label`, `Typography`) are design-system-aware and ready to accept `Controller` props
- Auth store (Zustand) + TanStack Query hooks (`useSignIn`, `useSignUp`) are ready
- Auth pages (`login.tsx`, `signup.tsx`) currently use raw `useState` — need migration to `react-hook-form`

### Migration steps

1. Create `packages/shared/` with Zod schemas for auth + onboarding
2. Install `react-hook-form` + `@hookform/resolvers` in `apps/native`
3. Migrate login/signup forms from `useState` → `Controller` + `useForm`
4. Create NestJS app with `apps/api/`, wire `ZodValidationPipe`
5. Import shared schemas into NestJS controllers
6. Replace mock TanStack Query mutations with actual API calls

## Dependencies

| Package | Where | Purpose |
|---------|-------|---------|
| `zod` | `packages/shared`, `apps/native`, `apps/api` | Schema definition + validation |
| `react-hook-form` | `apps/native` | Form state management |
| `@hookform/resolvers` | `apps/native` | Bridge between Zod and RHF |
| `nestjs-zod` (optional) | `apps/api` | Pre-built ZodValidationPipe for NestJS |

## Why Not Alternatives

| Alternative | Why not |
|-------------|---------|
| **gRPC** | Adds protobuf compilation step, no Zod reuse, overkill for CRUD without streaming. NestJS gRPC adds boilerplate. |
| **tRPC** | Fights NestJS DI/middleware patterns. Works better with Next.js or Express. |
| **GraphQL** | Duplicates schema definition (SDL + Zod). Codegen adds a build step. Great for complex data graphs but unnecessary here. |
| **class-validator** | NestJS-native but uses decorators (`@IsEmail()`), which don't work in plain TS for the shared package. Zod works everywhere. |
