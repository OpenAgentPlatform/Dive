import { RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InterfaceProvider } from '../../../../atoms/interfaceState';
import PopupConfirm from '../../../../components/PopupConfirm';
import Select from '../../../../components/Select';
import WrappedInput from '../../../../components/WrappedInput';
import { compressData } from '../../../../helper/config';
import { useModelsProvider } from '../ModelsProvider';
import { ModelVerifyDetail, useModelVerify } from '../ModelVerify';
import ReasoningLevelParameter from './SpecialParameters/ReasoningLevel';
import TokenBudgetParameter from './SpecialParameters/TokenBudget';
import { useAtom } from "jotai"
import { showToastAtom } from "../../../../atoms/toastState"
import Tooltip from "../../../../components/Tooltip"

interface AdvancedSettingPopupProps {
  modelName: string;
  onClose: () => void;
  onSave?: () => void;
}

export interface Parameter {
  name: string;
  type: 'int' | 'float' | 'string' | '';
  value: string | number;
  isSpecific?: boolean;
  isDuplicate?: boolean;
}

const AdvancedSettingPopup = ({ modelName, onClose, onSave }: AdvancedSettingPopupProps) => {
  const { t } = useTranslation();
  const [, showToast] = useAtom(showToastAtom)
  const {
    parameter,
    multiModelConfigList = [],
    currentIndex,
    setMultiModelConfigList,
  } = useModelsProvider();
  const { verify, abort } = useModelVerify();

  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [provider, setProvider] = useState<InterfaceProvider>('openai');
  const isVerifying = useRef(false);
  const [isVerifySuccess, setIsVerifySuccess] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<string>('');
  const [verifyDetail, setVerifyDetail] = useState<string>('');
  const bodyRef = useRef<HTMLDivElement>(null);

  // load parameters of current model
  useEffect(() => {
    // load existing parameters
    const modelParams: Parameter[] = [];
    const currentModelProvider = multiModelConfigList[currentIndex];

    // load parameters of current model
    if (currentModelProvider && currentModelProvider.parameters[modelName]) {
      // convert parameters to custom parameters structure list
      Object.entries(currentModelProvider.parameters[modelName]).forEach(([key, value]) => {
        if (!key) return;
        if (modelName.includes('o3-mini') && (['temperature', 'topP'].includes(key))) return;

        // special parameters handling, transform to custom parameters structure list
        if (key === 'thinking') {
          const thinking = value as any;
          if (thinking.type === 'enabled') {
            modelParams.push({ name: 'budget_tokens', type: 'int', value: thinking.budget_tokens, isSpecific: true });
          }
          return;
        }
        const paramType =
          typeof value === 'string' ? 'string' : Number.isInteger(value) ? 'int' : 'float';
        modelParams.push({
          name: key,
          type: paramType as 'int' | 'float' | 'string' | '',
          value: value as any,
        });
      });
    }

    // load other possible parameters
    if (parameter) {
      Object.entries(parameter).forEach(([key, value]) => {
        if (modelName.includes('o3-mini') && (['temperature', 'topP'].includes(key))) return;
        if (!modelParams.some((p) => p.name === key)) {
          const paramType =
            typeof value === 'string' ? 'string' : Number.isInteger(value) ? 'int' : 'float';
          modelParams.push({ name: key, type: paramType as 'int' | 'float' | 'string', value });
        }
      });
    }

    const provider = currentModelProvider.name;

    if (
      modelName.includes('o3-mini') &&
      provider === 'openai' &&
      !modelParams.some((p) => p.name === 'reasoning_effort')
    ) {
      modelParams.push({ name: 'reasoning_effort', type: 'string', value: 'low', isSpecific: true });
    }
    if (
      modelName.includes('sonnet-3.7') &&
      provider === 'anthropic' &&
      !modelParams.some((p) => p.name === 'budget_tokens')
    ) {
      modelParams.push({ name: 'budget_tokens', type: 'int', value: 1024, isSpecific: true });
    }

    setParameters(modelParams);
    setProvider(provider);
  }, [parameter, multiModelConfigList, currentIndex]);

  // integrate parameters config to current ModelConfig (not write just format)
  const integrateParametersConfig = () => {
    if (!multiModelConfigList || multiModelConfigList.length <= 0) {
      return [];
    }

    const finalParameters: Record<string, any> = {};
    const parameters_ = [...parameters];
    parameters_.forEach((param) => {
      if (!param.name || !param.type || !param.value) return;
      let value = param.value;
      let name = param.name;

      switch (param.type) {
        case 'int':
          value = parseInt(String(value), 10);
          if (value < 0) value = 0;
          if (value > 1000000) value = 1000000;
          break;
        case 'float':
          value = parseFloat(String(value));
          if (value < 0) value = 0;
          if (value > 1.0) value = 1.0;
          break;
        default:
          value = String(value);
          break;
      }

      if (param.name === 'budget_tokens') {
        // if there's other param at thinking in future, need adjust this.
        name = 'thinking';
        const value_ = value as number;
        value = {
          type: 'enabled',
          budget_tokens: value_,
        } as any;
      }
      finalParameters[name] = value;
    });

    const updatedModelConfigList = [...multiModelConfigList];
    updatedModelConfigList[currentIndex] = {
      ...updatedModelConfigList[currentIndex],
      parameters: {
        ...updatedModelConfigList[currentIndex].parameters,
        [modelName]: finalParameters,
      },
    };
    return updatedModelConfigList;
  };

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
    if (parameters.filter((p) => p.name === value).length > 1) {
      updatedParameters[index].isDuplicate = true;
    }
    else {
      updatedParameters[index].isDuplicate = false;
    }
    setParameters(updatedParameters);
  };

  const handleAddParameter = () => {
    setParameters([...parameters, { name: '', type: '', value: '' }]);
  };

  const handleDeleteParameter = (index: number) => {
    // careful, if the parameter is specific, don't delete it
    if (parameters[index].isSpecific) {
      return;
    }
    const updatedParameters = [...parameters];
    updatedParameters.splice(index, 1);
    setParameters(updatedParameters);
  };

  const handleClose = () => {
    onClose();
  };

  const handleSave = async () => {
    const integratedParametersConfig = integrateParametersConfig();
    if (integratedParametersConfig.length <= 0) {
      return;
    }
    setMultiModelConfigList(integratedParametersConfig);

    if (onSave) {
      onSave();
    }
    onClose();
  };

  // verify current model setting if work
  const onVerifyConfirm = async () => {
    isVerifying.current = true;
    setVerifyStatus('verifying')
    setVerifyDetail('')

    const integratedParametersConfig = integrateParametersConfig();
    if (integratedParametersConfig.length <= 0) {
      isVerifying.current = false;
      setVerifyStatus('error')
      setVerifyDetail('No model config to verify')
      return;
    }
    integratedParametersConfig[currentIndex].models = [modelName];
    const compressedData = compressData(
      integratedParametersConfig[currentIndex],
      currentIndex,
      parameter,
    );

    const _needVerifyList = compressedData;

    // verify complete callback
    const onComplete = async () => {
      isVerifying.current = false
      setIsVerifySuccess(true)
    };

    // update status callback
    const onUpdate = (detail: ModelVerifyDetail[]) => {
      const _detail = detail.find(item => item.name == modelName)
      if(_detail){
        console.log(_detail.detail)
        setVerifyStatus(_detail.status)
        if (!_detail.detail?.['connectingSuccess']) {
          setVerifyDetail(_detail.detail?.['connectingResult'] || '')
        }
        else if (!_detail.detail?.['supportTools']) {
          setVerifyDetail(_detail.detail?.['supportToolsResult'] || '')
        }
      }
    };

    // abort verify callback
    const onAbort = () => {
      setIsVerifySuccess(false)
    };

    verify(_needVerifyList, onComplete, onUpdate, onAbort);
  };

  useEffect(() => {
    if (bodyRef.current && (verifyDetail || verifyStatus)) {
      bodyRef.current.scrollTo({
        top: bodyRef.current.scrollHeight,
        // behavior: 'smooth'
      });
    }
  }, [verifyStatus, verifyDetail]);

  const handleCopiedError = async (text: string) => {
    await navigator.clipboard.writeText(text)
    showToast({
      message: t("toast.copiedToClipboard"),
      type: "success"
    })
  }

  return (
    <PopupConfirm
      zIndex={900}
      className="model-parameters-popup"
      confirmText={t('tools.save') || 'Save'}
      onConfirm={handleSave}
      onCancel={handleClose}
      onClickOutside={handleClose}
      noBorder={false}
      disabled={!isVerifySuccess || parameters.some((p) => p.isDuplicate)}
      footerHint={
        <FooterHint
          onVerifyConfirm={onVerifyConfirm}
          isVerifying={isVerifying}
        />
      }
    >
      <div className="models-key-popup parameters">
        <div className="models-key-form-group">
          <div className="header">{t('models.modelSetting', { name: modelName })}</div>

          <div className="body" ref={bodyRef}>
            {/* Special Parameters Area */}
            {SpecialParameters({ provider, modelName, parameters, setParameters })}

            {/* Custom Input Header */}
            <div className="add-custom-parameter">
              <div className="title">
                <label>{t('models.customInput')}</label>
              </div>
              <button className="btn" onClick={handleAddParameter}>
                <img src={'img://CircleAdd.svg'} />
                {t('models.addCustomParameter')}
              </button>
            </div>

            {/* Custom Input Parameters List */}
            <div className="model-custom-parameters">
              <div className="parameters-list">
                {parameters.map((param, index) => {
                  if (param.name === 'reasoning_effort' || param.name === 'budget_tokens') {
                    return null;
                  }
                  return (
                    <div key={index} className="item">
                      <div className="btn-delete" onClick={() => handleDeleteParameter(index)}>
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
                        <div>
                          <WrappedInput
                            className={param.isDuplicate ? 'error' : ''}
                            type="text"
                            value={param.name}
                            placeholder={t('models.parameterNameDescription')}
                            onChange={(e) => handleParameterNameChange(e.target.value, index)}
                          />
                          {param.isDuplicate && <div className="error-message">{t('models.parameterNameDuplicate')}</div>}
                        </div>
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
                            min={param.type === 'int' ? 0 : param.type === 'float' ? 0.0 : undefined}
                            max={param.type === 'int' ? 1000000 : param.type === 'float' ? 1.0 : undefined}
                            step={param.type === 'float' ? 0.1 : undefined}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              className={`verify-status-container ${verifyDetail ? 'error' : ''}`}
            >
              <div className="verify-info">
                <span>{verifyStatus}</span>
                {verifyDetail && <span> - {verifyDetail}</span>}
              </div>
              {verifyDetail && (
                <Tooltip content={t("models.copyContent")}>
                  <div onClick={() => handleCopiedError(verifyDetail)} className="error-message">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18px" height="18px" viewBox="0 0 22 22" fill="transparent">
                      <path d="M13 20H2V6H10.2498L13 8.80032V20Z" fill="transparent" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinejoin="round"/>
                      <path d="M13 9H10V6L13 9Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M9 3.5V2H17.2498L20 4.80032V16H16" fill="transparent" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinejoin="round"/>
                      <path d="M20 5H17V2L20 5Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      </div>
    </PopupConfirm>
  );
};

export default AdvancedSettingPopup;

const SpecialParameters = ({
  provider,
  modelName,
  parameters,
  setParameters,
}: {
  provider: InterfaceProvider;
  modelName: string;
  parameters: Parameter[];
  setParameters: (parameters: Parameter[]) => void;
}) => {
  if (modelName.includes('o3-mini') && provider === 'openai') {
    return <ReasoningLevelParameter parameters={parameters} setParameters={setParameters} />;
  }
  if (modelName.includes('claude-3-7') && provider === 'anthropic') {
    return (
      <TokenBudgetParameter
        min={0}
        max={128000}
        parameters={parameters}
        setParameters={setParameters}
      />
    );
  }
  return null;
};

const FooterHint = ({
  onVerifyConfirm,
  isVerifying,
}: {
  onVerifyConfirm: () => void,
  isVerifying: RefObject<boolean>
}) => {
  const { t } = useTranslation();
  return(
    <div>
      <button
        className="cancel-btn"
        onClick={() => {
          if (isVerifying.current) return;
          onVerifyConfirm();
        }}
        disabled={isVerifying.current ?? false}
      >
        {t('models.verify')}
      </button>
    </div>
  )
}