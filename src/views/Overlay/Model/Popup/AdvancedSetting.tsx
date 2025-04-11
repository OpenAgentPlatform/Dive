import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InterfaceModelConfig } from '../../../../atoms/configState';
import PopupConfirm from '../../../../components/PopupConfirm';
import Select from '../../../../components/Select';
import InfoTooltip from '../../../../components/Tooltip';
import WrappedInput from '../../../../components/WrappedInput';
import { ListOption, useModelsProvider } from '../ModelsProvider';
import { useModelVerify } from '../ModelVerify';

interface AdvancedSettingPopupProps {
  modelName: string;
  onClose: () => void;
  onSave?: (tokenBudget: number, parameters: Record<string, any>) => void;
}

interface Parameter {
  name: string;
  type: 'int' | 'float' | 'string' | '';
  value: string | number;
}

const SPECIAL_PARAMETER_LIST = ['budget', 'reasoningLevel'];
const BUDGET_KEY_WORD = ['sonnet-3.7'];
const REASONING_LEVEL_KEY_WORD = ['o3-mini'];

const AdvancedSettingPopup = ({ modelName, onClose, onSave }: AdvancedSettingPopupProps) => {
  const { t } = useTranslation();
  const {
    parameter,
    multiModelConfigList = [],
    currentIndex,
    setMultiModelConfigList,
  } = useModelsProvider();
  const { verify, abort } = useModelVerify();

  const [tokenBudget, setTokenBudget] = useState<number>(2048);
  const [parameters, setParameters] = useState<Parameter[]>([]);
  const isVerifying = useRef(false);
  const [verifyingCnt, setVerifyingCnt] = useState(0);
  const [verifiedCnt, setVerifiedCnt] = useState(0);

  // 從當前模型載入參數
  useEffect(() => {
    // 載入已有的參數
    const modelParams: Parameter[] = [];
    const currentModelProvider = multiModelConfigList[currentIndex];

    // 載入特定模型的參數
    if (currentModelProvider && currentModelProvider.parameters[modelName]) {
      // 將參數轉換為自訂參數列表
      Object.entries(currentModelProvider.parameters[modelName]).forEach(([key, value]) => {
        if (key !== 'maxTokens') {
          const paramType =
            typeof value === 'string' ? 'string' : Number.isInteger(value) ? 'int' : 'float';
          modelParams.push({
            name: key,
            type: paramType as 'int' | 'float' | 'string' | '',
            value: value as any,
          });
        }
      });

      // 檢查是否有自定義的 maxTokens
      const customMaxTokens = (currentModelProvider as any).maxTokens;
      if (customMaxTokens !== undefined) {
        setTokenBudget(customMaxTokens);
      }
    }

    // 載入其他可能的自訂參數
    if (parameter) {
      Object.entries(parameter).forEach(([key, value]) => {
        // 排除已經添加的參數和 maxTokens
        if (key !== 'maxTokens' && !modelParams.some((p) => p.name === key)) {
          const paramType =
            typeof value === 'string' ? 'string' : Number.isInteger(value) ? 'int' : 'float';
          modelParams.push({ name: key, type: paramType as 'int' | 'float' | 'string', value });
        }
      });
    }

    setParameters(modelParams);
  }, [parameter, multiModelConfigList, currentIndex]);

  const handleParameterTypeChange = (type: 'int' | 'float' | 'string', index?: number) => {
    if (index == undefined || index < 0) return;

    const updatedParameters = [...parameters];
    updatedParameters[index].type = type;
    setParameters(updatedParameters);
  };

  const handleParameterValueChange = (value: string | number, index?: number) => {
    if (index == undefined || index < 0) return;

    const updatedParameters = [...parameters];
    updatedParameters[index].value = value;
    setParameters(updatedParameters);
  };

  const handleParameterNameChange = (value: string, index?: number) => {
    if (index == undefined || index < 0) return;

    const updatedParameters = [...parameters];
    updatedParameters[index].name = value;
    setParameters(updatedParameters);
  };

  const addParameter = () => {
    setParameters([...parameters, { name: '', type: '', value: '' }]);
  };

  const deleteParameter = (index: number) => {
    const updatedParameters = [...parameters];
    updatedParameters.splice(index, 1);
    setParameters(updatedParameters);
  };

  const handleClose = () => {
    onClose();
  };

  const handleSave = async () => {
    // 將參數轉換為物件格式
    const finalParameters: Record<string, any> = {};

    // 添加所有自訂參數
    parameters.forEach((param) => {
      let value = param.value;

      // 根據類型轉換值
      if (param.type === 'int') {
        value = parseInt(String(value), 10);
      } else if (param.type === 'float') {
        value = parseFloat(String(value));
      } else {
        value = String(value);
      }

      finalParameters[param.name] = value;
    });

    // 設定 Token Budget
    finalParameters.maxTokens = tokenBudget;

    // 更新當前模型的參數
    if (multiModelConfigList && multiModelConfigList.length > 0) {
      // 只更新當前模型的參數
      const updatedModelConfigList = [...multiModelConfigList];
      updatedModelConfigList[currentIndex] = {
        ...updatedModelConfigList[currentIndex],
        parameters: {
          ...updatedModelConfigList[currentIndex].parameters,
          [modelName]: finalParameters,
        },
      };

      // 設置更新後的模型列表
      setMultiModelConfigList(updatedModelConfigList);
    }

    if (onSave) {
      onSave(tokenBudget, finalParameters);
    }

    onClose();
  };

  const onVerifyConfirm = async (
    needVerifyList?: Record<string, InterfaceModelConfig>,
    ifSave: boolean = true,
  ) => {
    setVerifiedCnt(0);
    isVerifying.current = true;
    // 將參數轉換為物件格式
    const finalParameters: Record<string, any> = {};

    // 添加所有自訂參數
    parameters.forEach((param) => {
      let value = param.value;

      // 根據類型轉換值
      if (param.type === 'int') {
        value = parseInt(String(value), 10);
      } else if (param.type === 'float') {
        value = parseFloat(String(value));
      } else {
        value = String(value);
      }

      finalParameters[param.name] = value;
    });

    // 設定 Token Budget
    finalParameters.maxTokens = tokenBudget;

    let _needVerifyList = {} as Record<string, InterfaceModelConfig>;

    // 更新當前模型的參數
    if (multiModelConfigList && multiModelConfigList.length > 0) {
      // 只更新當前模型的參數
      const { parameters, ...rest } = multiModelConfigList[currentIndex];
      _needVerifyList[modelName] = {
        ...rest,
        ...finalParameters,
        modelProvider: rest.name
      } as unknown as InterfaceModelConfig;
    }

    // 驗證完成時的回調
    const onComplete = async () => {};

    // 更新狀態回調
    const onUpdate = () => {};

    // 中止驗證回調
    const onAbort = () => {};

    // 開始驗證
    verify(_needVerifyList, onComplete, onUpdate, onAbort);
  };

  return (
    <PopupConfirm
      zIndex={900}
      className="model-parameters-popup"
      confirmText={t('tools.save') || 'Save'}
      onConfirm={handleSave}
      onCancel={handleClose}
      onClickOutside={handleClose}
      noBorder={true}
      footerHint={
        <>
          <button
            className="confirm-btn"
            onClick={() => {
              onVerifyConfirm()
            }}
          >
            {t('models.verify')}
          </button>
          {isVerifying.current && (
            <div className="models-progress-wrapper">
              <div className="models-progress-text">
                {t('models.progressVerifying')}
                <div className="models-progress-text-right">
                  <div className="abort-button" onClick={abort}>
                    <svg width="20" height="20" viewBox="0 0 24 24">
                      <path d="M8 6h2v12H8zm6 0h2v12h-2z" fill="currentColor" />
                    </svg>
                  </div>
                  <span>{`${verifiedCnt} / ${verifyingCnt}`}</span>
                </div>
              </div>
              <div className="models-progress-container">
                <div
                  className="models-progress"
                  style={{
                    width: `${(verifiedCnt / verifyingCnt) * 100}%`,
                  }}
                ></div>
              </div>
            </div>
          )}
        </>
      }
    >
      <div className="models-key-popup">
        <div className="models-key-form-group">
          <div className="header">{t('models.modelSetting', { name: modelName })}</div>

          <div className="body">
            {/* Custom Input 設定區域 */}
            <div className="add-custom-parameter">
              <div className="title">
                <label>{t('models.customInput')}</label>
              </div>
              <button className="btn" onClick={addParameter}>
                <img src={'img://CircleAdd.svg'} />
                {t('models.addCustomParameter')}
              </button>
            </div>

            {/* 已添加的參數列表 */}
            <div className="model-custom-parameters">
              <div className="parameters-list">
                {parameters.map((param, index) => (
                  <div key={index} className="item">
                    <div className="btn-delete" onClick={() => deleteParameter(index)}>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="22"
                        height="22"
                        viewBox="0 0 22 22"
                        fill="none"
                      >
                        <path
                          d="M3 5H19"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M17 7V18.2373C16.9764 18.7259 16.7527 19.1855 16.3778 19.5156C16.0029 19.8457 15.5075 20.0192 15 19.9983H7C6.49249 20.0192 5.99707 19.8457 5.62221 19.5156C5.24735 19.1855 5.02361 18.7259 5 18.2373V7"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M8 10.04L14 16.04"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M14 10.04L8 16.04"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M13.5 2H8.5C8.22386 2 8 2.22386 8 2.5V4.5C8 4.77614 8.22386 5 8.5 5H13.5C13.7761 5 14 4.77614 14 4.5V2.5C14 2.22386 13.7761 2 13.5 2Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <div className="name">
                      <label>{t('models.parameterName')}</label>
                      <WrappedInput
                        type="text"
                        value={param.name}
                        placeholder={t('models.parameterNameDescription')}
                        onChange={(e) => handleParameterNameChange(e.target.value, index)}
                      />
                    </div>
                    <div className="row">
                      <div className="type">
                        <label>{t('models.parameterType')}</label>
                        <Select
                          options={[
                            { value: 'int', label: 'int', info: t('models.parameterTypeInt') },
                            {
                              value: 'float',
                              label: 'float',
                              info: t('models.parameterTypeFloat'),
                            },
                            {
                              value: 'string',
                              label: 'string',
                              info: t('models.parameterTypeString'),
                            },
                          ]}
                          value={param.type}
                          onSelect={(value) =>
                            handleParameterTypeChange(value as 'int' | 'float' | 'string', index)
                          }
                          placeholder={t('models.parameterTypeDescription')}
                          size="m"
                        />
                      </div>
                      <div className="value">
                        <label>{t('models.parameterValue')}</label>
                        <WrappedInput
                          type={param.type === 'string' ? 'text' : 'number'}
                          value={param.value}
                          onChange={(e) => handleParameterValueChange(e.target.value, index)}
                          placeholder={t('models.parameterValueDescription')}
                          disabled={param.type === ''}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PopupConfirm>
  );
};

export default AdvancedSettingPopup;

const BudgetParameter = () => {
  const { t } = useTranslation();
  const handleTokenBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // setTokenBudget(Number(e.target.value));
  };

  return (
    <div className="special-parameter">
      <div className="title align-top">
        <label>Token Budget</label>
        <InfoTooltip
          side="left"
          content={
            t('models.tokenBudgetTooltip') || 'Set the token budget limit for model responses'
          }
        >
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
      <div className="body">
        <div className="token-budget-value align-top">
          <WrappedInput
            type="number"
            value={1}
            onChange={(e) => {}}
          />
        </div>
        <div className="token-budget-slider">
          <input
            type="range"
            min="1024"
            max="4096"
            step="1"
            value={1}
            onChange={() => {}}
            className="slider"
          />
          <div className="range-values">
            <span>1024</span>
            <span>4096</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const ReasoningLevelParameter = () => {
  return <div>ReasoningLevelParameter</div>;
};
