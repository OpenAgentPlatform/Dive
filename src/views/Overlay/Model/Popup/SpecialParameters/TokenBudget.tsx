import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import WrappedInput from '../../../../../components/WrappedInput'
import { Parameter } from '../../../../../helper/modelParameterUtils'

const TokenBudgetParameter = ({
  min,
  max,
  parameters,
  setParameters,
}: {
  min: number
  max: number
  parameters: Parameter[]
  setParameters: (parameters: Parameter[]) => void
}) => {
  // last saving format is -- thinking: {"type": "enabled", "budget_tokens": 10_000}
  const { t } = useTranslation()
  const [tokenBudget, setTokenBudget] = useState<number>(0)

  useEffect(() => {
    const parameter = parameters.find((p) => p.name === 'budget_tokens' && p.isSpecific)
    if (parameter) {
      setTokenBudget(Number(parameter.value))
    }
  }, [parameters])

  const handleTokenBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const updatedParameters = [...parameters]
    const parameter = updatedParameters.find((p) => p.name === 'budget_tokens' && p.isSpecific)
    if (parameter) {
      parameter.value = Number(e.target.value)
    } else {
      updatedParameters.push({
        name: 'budget_tokens',
        type: 'int',
        value: Number(e.target.value),
        isSpecific: true,
      })
    }
    setParameters(updatedParameters)
  }

  return (
    <div className="special-parameter start">
      <div className="content">
        <div className="title">
          <label>Token Budget</label>
          <div className="description">{t('models.tokenBudgetDescription', { min, max })}</div>
        </div>
        <div className="body">
          <div className="token-budget-value align-top">
            <WrappedInput
              type="number"
              value={tokenBudget}
              onChange={(e) => handleTokenBudgetChange(e)}
            />
          </div>
          <div className="token-budget-slider">
            <input
              type="range"
              min={min}
              max={max}
              step="1"
              value={tokenBudget}
              onChange={(e) => handleTokenBudgetChange(e)}
              className="slider"
            />
            <div className="range-values">
              <span>{min}</span>
              <span>{max}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TokenBudgetParameter
