import { applyDecorators, HttpStatus, Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { genericErrorForStatus } from '../errors/error-http-mapping';
import { ApiErrorDto, ApiMetaDto } from './api-envelope.dto';

interface EnvelopeOptions {
  status?: HttpStatus;
  description?: string;
  isArray?: boolean;
}

/** One model, or several alternatives (documented as `oneOf`). */
type EnvelopeModel = Type<unknown> | readonly Type<unknown>[] | null;

function isAlternatives(
  model: EnvelopeModel,
): model is readonly Type<unknown>[] {
  return Array.isArray(model);
}

function dataSchema(model: EnvelopeModel, isArray: boolean) {
  if (!model) return { nullable: true, example: null };
  if (isAlternatives(model)) {
    return {
      oneOf: model.map((alternative) => ({
        $ref: getSchemaPath(alternative),
      })),
    };
  }
  const ref = { $ref: getSchemaPath(model) };
  return isArray ? { type: 'array', items: ref } : ref;
}

function modelsOf(model: EnvelopeModel): Type<unknown>[] {
  if (!model) return [];
  return isAlternatives(model) ? [...model] : [model];
}

/** Documents a success response wrapped in `{ data, meta, error: null }`. */
export function ApiEnvelopeResponse(
  model: EnvelopeModel,
  options: EnvelopeOptions = {},
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiExtraModels(ApiMetaDto, ...modelsOf(model)),
    ApiResponse({
      status: options.status ?? HttpStatus.OK,
      description: options.description,
      schema: {
        type: 'object',
        required: ['data', 'meta', 'error'],
        properties: {
          data: dataSchema(model, options.isArray ?? false),
          meta: { $ref: getSchemaPath(ApiMetaDto) },
          error: { nullable: true, example: null },
        },
      },
    }),
  );
}

/** Documents error responses wrapped in `{ data: null, meta, error }`. */
export function ApiErrorResponses(
  ...statuses: HttpStatus[]
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiExtraModels(ApiMetaDto, ApiErrorDto),
    ...statuses.map((status) =>
      ApiResponse({
        status,
        description: genericErrorForStatus(status).code,
        schema: {
          type: 'object',
          required: ['data', 'meta', 'error'],
          properties: {
            data: { nullable: true, example: null },
            meta: { $ref: getSchemaPath(ApiMetaDto) },
            error: { $ref: getSchemaPath(ApiErrorDto) },
          },
        },
      }),
    ),
  );
}
