import { Question, QuestionSet } from 'nest-commander';

export const CREATE_ADMIN_QUESTIONS = 'create-admin-questions';

export interface CreateAdminAnswers {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  passwordConfirmation: string;
}

/** Interactive prompts; questions already answered by CLI flags are skipped. */
@QuestionSet({ name: CREATE_ADMIN_QUESTIONS })
export class CreateAdminQuestions {
  @Question({ type: 'input', name: 'email', message: 'Admin email:' })
  parseEmail(value: string): string {
    return value.trim();
  }

  @Question({ type: 'input', name: 'firstName', message: 'First name:' })
  parseFirstName(value: string): string {
    return value.trim();
  }

  @Question({ type: 'input', name: 'lastName', message: 'Last name:' })
  parseLastName(value: string): string {
    return value.trim();
  }

  @Question({
    type: 'password',
    name: 'password',
    message: 'Password (min. 12 characters):',
    mask: '*',
  })
  parsePassword(value: string): string {
    return value;
  }

  @Question({
    type: 'password',
    name: 'passwordConfirmation',
    message: 'Confirm password:',
    mask: '*',
  })
  parsePasswordConfirmation(value: string): string {
    return value;
  }
}
