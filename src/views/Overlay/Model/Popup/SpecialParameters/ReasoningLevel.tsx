import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import InfoTooltip from '../../../../../components/Tooltip'
import { Parameter } from '../../../../../helper/modelParameterUtils'

const ReasoningLevelParameter = ({
  parameters,
  setParameters,
}: {
  parameters: Parameter[]
  setParameters: (parameters: Parameter[]) => void
}) => {
  // reasoning_effort
  const { t } = useTranslation()

  const [reasoningLevel, setReasoningLevel] = useState<string>('low')

  useEffect(() => {
    const parameter = parameters.find((p) => p.name === 'reasoning_effort' && p.isSpecific)
    if (parameter) {
      setReasoningLevel(parameter.value as string)
    }
  }, [parameters])

  const handleReasoningLevelChange = (level: string) => {
    const updatedParameters = [...parameters]
    const parameter = updatedParameters.find((p) => p.name === 'reasoning_effort' && p.isSpecific)
    if (parameter) {
      parameter.value = level
    } else {
      updatedParameters.push({
        name: 'reasoning_effort',
        type: 'string',
        value: level,
        isSpecific: true,
      })
    }
    setParameters(updatedParameters)
    setReasoningLevel(level)
  }

  return (
    <div className="special-parameter">
      <div className="content">
        <div className="title align-top">
          <div className="title-left">
            <label>Reasoning Level</label>
            <InfoTooltip side="left" content={t('models.reasoningLevelTooltip')}>
              <div className="parameter-label">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 23 22"
                  width="15"
                  height="15"
                >
                  <g clipPath="url(#ic_information_svg__a)">
                    <circle
                      cx="11.5"
                      cy="11"
                      r="10.25"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    ></circle>
                    <path
                      fill="currentColor"
                      d="M9.928 13.596h3.181c-.126-2.062 2.516-2.63 2.516-5.173 0-2.01-1.6-3.677-4.223-3.608-2.229.051-4.08 1.288-4.026 3.9h2.714c0-.824.593-1.168 1.222-1.185.593 0 1.258.326 1.222.962-.144 1.942-2.911 2.389-2.606 5.104Zm1.582 3.591c.988 0 1.779-.618 1.779-1.563 0-.963-.791-1.581-1.78-1.581-.97 0-1.76.618-1.76 1.58 0 .946.79 1.565 1.76 1.565Z"
                    ></path>
                  </g>
                  <defs>
                    <clipPath id="ic_information_svg__a">
                      <path fill="currentColor" d="M.5 0h22v22H.5z"></path>
                    </clipPath>
                  </defs>
                </svg>
              </div>
            </InfoTooltip>
          </div>
          <div className="description">{t('models.reasoningLevelDescription')}</div>
        </div>
        <div className="body">
          <div className="reasoning-level-btn-group">
            <button
              className={`btn ${reasoningLevel === 'low' ? 'active' : ''}`}
              onClick={() => handleReasoningLevelChange('low')}
            >
              <span>Low</span>
            </button>
            <button
              className={`btn ${reasoningLevel === 'medium' ? 'active' : ''}`}
              onClick={() => handleReasoningLevelChange('medium')}
            >
              <span>Medium</span>
            </button>
            <button
              className={`btn ${reasoningLevel === 'high' ? 'active' : ''}`}
              onClick={() => handleReasoningLevelChange('high')}
            >
              <span>High</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReasoningLevelParameter
