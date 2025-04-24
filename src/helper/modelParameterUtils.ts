import { InterfaceProvider } from '../atoms/interfaceState'

export interface Parameter {
  name: string
  type: 'int' | 'float' | 'string' | 'boolean' | ''
  value: string | number | boolean
  isSpecific?: boolean // if true, the parameter is a special parameter, to avoid removing it when duplicate
  isDuplicate?: boolean // if true, the parameter is a duplicate parameter
}

/**
 * Initializes model parameters, adding default special parameters if necessary.
 */
export function initializeAdvancedParameters(
  modelName: string,
  provider: InterfaceProvider,
  existingParams: Record<string, any> | undefined,
): Parameter[] {
  const modelParams: Parameter[] = []

  // load existing parameters
  if (existingParams) {
    Object.entries(existingParams).forEach(([key, value]) => {
      if (!key) return
      // temperature and topP are not default parameters handled here
      if (['temperature', 'topP'].includes(key)) return

      // special parameters handling, transform to custom parameters structure list
      if (key === 'thinking') {
        const thinking = value as any
        if (thinking.type === 'enabled' && thinking.budget_tokens !== undefined) {
          modelParams.push({
            name: 'budget_tokens',
            type: 'int',
            value: thinking.budget_tokens,
            isSpecific: true,
          })
        }
        return
      }
      // Handle disable_streaming specifically if it exists
      if (key === 'disable_streaming') {
        modelParams.push({
          name: 'disable_streaming',
          type: 'boolean',
          value: typeof value === 'boolean' ? value : false, // Ensure boolean
          isSpecific: true,
        })
        return
      }

      const paramType =
        typeof value === 'string'
          ? 'string'
          : typeof value === 'number'
          ? Number.isInteger(value)
            ? 'int'
            : 'float'
          : '' // Default or unknown type
      if (paramType) {
        modelParams.push({
          name: key,
          type: paramType as 'int' | 'float' | 'string',
          value: value as any,
          isSpecific: ['reasoning_effort', 'budget_tokens', 'disable_streaming'].includes(key),
        })
      }
    })
  }

  // Add default reasoning_effort for o3-mini if needed
  if (
    modelName.includes('o3-mini') &&
    provider === 'openai' &&
    !modelParams.some((p) => p.name === 'reasoning_effort')
  ) {
    modelParams.push({ name: 'reasoning_effort', type: 'string', value: 'low', isSpecific: true })
  }

  // Add default budget_tokens for claude-3-7 if needed
  if (
    modelName.includes('claude-3-7') && // Assuming this is the correct check string
    (provider === 'anthropic' || provider === 'bedrock') &&
    !modelParams.some((p) => p.name === 'budget_tokens')
  ) {
    modelParams.push({ name: 'budget_tokens', type: 'int', value: 1024, isSpecific: true })
  }

  // Ensure disable_streaming parameter exists
  if (!modelParams.some((p) => p.name === 'disable_streaming')) {
    modelParams.push({ name: 'disable_streaming', type: 'boolean', value: false, isSpecific: true })
  }

  return modelParams
}

/**
 * Formats the parameters array into a record suitable for saving, applying type conversions and specific transformations.
 */
export function formatParametersForSave(parameters: Parameter[]): Record<string, any> {
  const finalParameters: Record<string, any> = {}
  parameters.forEach((param) => {
    if (!param.name || param.type === '' || param.value === '') return // Allow boolean false for disable_streaming
    let value = param.value
    let name = param.name

    switch (param.type) {
      case 'int':
        value = parseInt(String(value), 10)
        if (isNaN(value)) value = 0 // Default to 0 if parsing fails
        if (value < 0) value = 0
        if (value > 1000000) value = 1000000

        if (param.name === 'budget_tokens') {
          if (value < 1024) value = 1024
          if (value > 4096) value = 4096
        }
        break
      case 'float':
        value = parseFloat(String(value))
        if (isNaN(value)) value = 0.0 // Default to 0.0 if parsing fails
        if (value < 0) value = 0
        if (value > 1.0) value = 1.0
        break
      case 'boolean':
        // Already handled by Parameter type, ensure it's boolean
        value = typeof value === 'boolean' ? value : String(value).toLowerCase() === 'true'
        break
      case 'string':
      default:
        value = String(value)
        break
    }

    // Special handling for budget_tokens -> thinking object
    if (param.name === 'budget_tokens') {
      name = 'thinking'
      const value_ = value as number
      value = {
        type: 'enabled',
        budget_tokens: value_,
      } as any
    }

    // Assign value if not handled specifically above
    finalParameters[name] = value
  })

  return finalParameters
}
