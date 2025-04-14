import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import InfoTooltip from '../../../../../components/InfoTooltip'
import Switch from '../../../../../components/Switch'
import { Parameter } from '../AdvancedSetting'

const NonStreamingParameter = ({
  modelName,
  parameters,
  setParameters,
}: {
  modelName: string
  parameters: Parameter[]
  setParameters: (parameters: Parameter[]) => void
}) => {
  const { t } = useTranslation()
  const [isStreamingMode, setIsStreamingMode] = useState<boolean>(false)

  useEffect(() => {
    const parameter = parameters.find((p) => p.name === 'non_streaming' && p.isSpecific)
    if (parameter) {
      setIsStreamingMode(parameter.value as boolean)
    }
  }, [parameters])

  const handleStreamingModeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const updatedParameters = [...parameters]
    const parameter = updatedParameters.find((p) => p.name === 'non_streaming' && p.isSpecific)
    if (parameter) {
      parameter.value = e.target.checked
    } else {
      updatedParameters.push({ name: 'non_streaming', type: 'boolean', value: e.target.checked, isSpecific: true })
    }
    setParameters(updatedParameters)
  }

  return (
    <div className="special-parameter non-streaming">
      <div className="content">
        <div className="title">
          <div className="title-left">
            <label>Non-Streaming Mode</label>
            <InfoTooltip maxWidth={270} side="left" content={t('models.streamingModeTooltip')}>
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
          <div className="description">{t('models.streamingModeDescription')}</div>
        </div>
        <div className="body">
          <div className="non-streaming-switch">
            <label>
              {isStreamingMode ? t('models.alreadyOpen') : t('models.alreadyClose')}
            </label>
            <Switch
              checked={isStreamingMode}
              onChange={handleStreamingModeChange}
              name="streaming-mode"
            />
          </div>
        </div>
      </div>

      <div className={clsx('non-streaming-alert', !isStreamingMode && 'visible')}>
        <img src={'img://Alert.svg'} alt="info" />
        <div className="alert-content">{t('models.streamingModeAlert', { name: modelName })}</div>
      </div>
    </div>
  )
}

export default NonStreamingParameter
