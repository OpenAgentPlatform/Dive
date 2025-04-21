import { useAtom } from "jotai";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { InterfaceModelConfig, ModelConfig } from "../../../atoms/configState";
import {
  defaultInterface,
  FieldDefinition,
  InterfaceProvider,
  PROVIDER_LABELS,
  PROVIDERS,
} from "../../../atoms/interfaceState";
import { showToastAtom } from "../../../atoms/toastState";
import CheckBox from "../../../components/CheckBox";
import PopupConfirm from "../../../components/PopupConfirm";
import { formatData } from "../../../helper/config";
import { useModelsProvider } from "./ModelsProvider";

const KeyPopupEdit = ({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (customModelID?: string) => void;
}) => {
  const { t } = useTranslation();
  const [provider, setProvider] = useState<InterfaceProvider>(PROVIDERS[0]);
  const [fields, setFields] = useState<Record<string, FieldDefinition>>(
    defaultInterface[provider]
  );

  const [formData, setFormData] = useState<InterfaceModelConfig>({
    active: true,
  } as InterfaceModelConfig);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [customModelID, setCustomModelID] = useState<string>("");
  const isVerifying = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, showToast] = useAtom(showToastAtom);
  const [showOptional, setShowOptional] = useState<Record<string, Record<string, boolean>>>({});
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const {
    currentIndex,
    multiModelConfigList,
    setMultiModelConfigList,
    saveConfig,
    prepareModelConfig,
    fetchListOptions,
    setCurrentIndex,
  } = useModelsProvider();

  const modelConfig = multiModelConfigList?.[currentIndex];

  useEffect(() => {
    return () => {
      isVerifying.current = false;
    };
  }, []);

  useEffect(() => {
    if (modelConfig) {
      const modelProvider =
        (modelConfig.name as InterfaceProvider) || PROVIDERS[0];
      setProvider(modelProvider);
      setFields(defaultInterface[modelProvider]);

      const modelData: InterfaceModelConfig = {
        apiKey: modelConfig.apiKey,
        baseURL: modelConfig.baseURL,
        model: modelConfig.model,
        topP: modelConfig.topP,
        temperature: modelConfig.temperature,
        active: modelConfig.active !== false,
        modelProvider: modelProvider,
        configuration: {
          topP: modelConfig.topP,
          temperature: modelConfig.temperature,
        },
      };

      setFormData(modelData);

      // const customModelList = localStorage.getItem("customModelList");
      // if (customModelList) {
      //   const parsedList = JSON.parse(customModelList);
      //   const key = modelConfig.apiKey || modelConfig.baseURL;
      //   if (key && parsedList[key]?.length) {
      //     setCustomModelID(parsedList[key][0] || "");
      //   }
      // }

      if (
        modelConfig.baseURL &&
        defaultInterface[modelProvider]?.baseURL &&
        !defaultInterface[modelProvider].baseURL.required
      ) {
        setShowOptional((prev) => ({ ...prev, [modelProvider]: { ...showOptional[modelProvider], baseURL: true } }));
      }
    }
  }, [modelConfig]);

  const handleChange = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    Object.entries(fields).forEach(([key, field]) => {
      if (field.required && !formData[key as keyof InterfaceModelConfig]) {
        newErrors[key] = t("setup.required");
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return false;
    }
    return true;
  };

  const handleSubmit = async (data: Record<string, any>) => {
    try {
      if (data.success) {
        onSuccess(customModelID);
      }
    } catch (error) {
      console.error("Failed to save config:", error);
      showToast({
        message: t("setup.saveFailed"),
        type: "error",
      });
    }
  };

  const onConfirm = async () => {
    if (!validateForm()) return;

    const __formData = {
      ...formData,
      baseURL:
        !fields?.baseURL?.required && !showOptional[provider]?.baseURL
          ? ""
          : formData.baseURL,
    };

    // 判斷是否為編輯現有配置或新建配置
    const isEditing = modelConfig !== undefined;

    // 如果不是編輯現有配置，則檢查是否已存在相同配置
    let existingIndex = -1;
    if (!isEditing && multiModelConfigList && multiModelConfigList.length > 0) {
      if (__formData.baseURL) {
        if (__formData.apiKey) {
          existingIndex = multiModelConfigList.findIndex(
            (config) =>
              config.baseURL === __formData.baseURL &&
              config.apiKey === __formData.apiKey
          );
        } else {
          existingIndex = multiModelConfigList.findIndex(
            (config) => config.baseURL === __formData.baseURL
          );
        }
      } else if (__formData.apiKey) {
        existingIndex = multiModelConfigList.findIndex(
          (config) => config.apiKey === __formData.apiKey
        );
      }
    }

    if (existingIndex !== -1) {
      setCurrentIndex(existingIndex);
      onSuccess();
      return;
    }

    const _formData = prepareModelConfig(__formData, provider);
    const multiModelConfig = {
      ...formatData(_formData),
      name: provider,
    };

    const _multiModelConfigList = JSON.parse(
      JSON.stringify(multiModelConfigList)
    );

    try {
      setErrors({});
      setIsSubmitting(true);
      isVerifying.current = true;

      // 對於新增和編輯都進行API金鑰驗證，但編輯時如果有自定義模型ID則跳過
      if (!(isEditing && customModelID)) {
        const listOptions = await fetchListOptions(multiModelConfig, fields);

        if (!listOptions?.length) {
          const newErrors: Record<string, string> = {};
          newErrors["apiKey"] = t("models.apiKeyError");
          setErrors(newErrors);
          return;
        }
      }

      // 保存自定義模型列表
      if (customModelID) {
        const customModelList = localStorage.getItem("customModelList");
        const allCustomModelList = customModelList
          ? JSON.parse(customModelList)
          : {};
        allCustomModelList[_formData.apiKey || _formData.baseURL] = [...(allCustomModelList[_formData.apiKey || _formData.baseURL] || []), customModelID];
        localStorage.setItem(
          "customModelList",
          JSON.stringify(allCustomModelList)
        );
      }

      if (isEditing) {
        const updatedList = [...(multiModelConfigList || [])];
        updatedList[currentIndex] = multiModelConfig;
        setMultiModelConfigList(updatedList);
        setCurrentIndex(currentIndex);
      }
      const data = await saveConfig();
      await handleSubmit(data);
    } catch (error) {
      const newErrors: Record<string, string> = {};
      newErrors["apiKey"] = t("models.apiKeyError");
      setErrors(newErrors);
      setMultiModelConfigList(_multiModelConfigList);
    } finally {
      setIsSubmitting(false);
      isVerifying.current = false;
    }
  };

  const handleClose = () => {
    if (isVerifying.current) {
      showToast({
        message: t("models.verifyingAbort"),
        type: "error",
      });
    }
    onClose();
  };

  const toggleApiKeyVisibility = () => {
    setIsApiKeyVisible(!isApiKeyVisible);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true);
      showToast({
        message: t("toast.copiedToClipboard"),
        type: "success",
      });
      setTimeout(() => {
        setCopySuccess(false);
      }, 3000);
    });
  };

  return (
    <>
      <PopupConfirm
        noBorder={true}
        zIndex={900}
        footerType="center"
        onConfirm={onConfirm}
        confirmText={
          isVerifying.current || isSubmitting ? (
            <div className="loading-spinner"></div>
          ) : (
            t("tools.save")
          )
        }
        disabled={isVerifying.current || isSubmitting}
        onCancel={handleClose}
        onClickOutside={handleClose}
      >
        <div className="models-key-popup edit">
          <div className="models-key-form-group">
            <div className="title">
              {t("models.editProviderTitle", { provider: PROVIDER_LABELS[provider] })}
            </div>
          </div>
          {Object.entries(fields).map(
            ([key, field]) =>
              key !== "model" && (
                <div key={key} className="models-key-form-group">
                  <label className="models-key-field-title">
                    <>
                      {key === "baseURL" && !field.required ? (
                        <div className="models-key-field-optional">
                          <CheckBox
                            checked={showOptional[provider]?.baseURL}
                            onChange={() =>
                              setShowOptional((prev) => ({
                                ...prev,
                                [provider]: { ...prev[provider], baseURL: !prev[provider]?.baseURL },
                              }))
                            }
                          ></CheckBox>
                          {`${field.label}${t("models.optional")}`}
                        </div>
                      ) : (
                        field.label
                      )}
                      {field.required && <span className="required">*</span>}
                    </>
                    <div className="models-key-field-description">
                      {field.description}
                    </div>
                  </label>
                  {(showOptional[provider]?.[key] ||
                    key !== "baseURL" ||
                    field.required) && (
                    <>
                      <div className="api-key-input-wrapper">
                        <input
                          type={
                            key === "apiKey" && !isApiKeyVisible
                              ? "password"
                              : "text"
                          }
                          value={
                            (formData[key as keyof ModelConfig] as string) || ""
                          }
                          onChange={(e) => handleChange(key, e.target.value)}
                          placeholder={field.placeholder?.toString()}
                          className={`api-key-input ${
                            errors[key] ? "error" : ""
                          }`}
                        />
                        {key === "apiKey" && (
                          <div className="api-key-actions">
                            <button
                              type="button"
                              className="icon-button show-hide-button"
                              onClick={toggleApiKeyVisibility}
                              title={
                                isApiKeyVisible
                                  ? t("models.hide")
                                  : t("models.display")
                              }
                            >
                              <img
                                src={
                                  isApiKeyVisible
                                    ? "img://Hide.svg"
                                    : "img://Show.svg"
                                }
                                alt={
                                  isApiKeyVisible
                                    ? t("models.hide")
                                    : t("models.display")
                                }
                                width="20"
                                height="20"
                              />
                            </button>
                            <button
                              type="button"
                              className="icon-button copy-button"
                              onClick={() =>
                                copyToClipboard(formData.apiKey || "")
                              }
                              title={t("models.copy")}
                            >
                              {copySuccess ? (
                                <svg
                                  className="correct-icon"
                                  xmlns="http://www.w3.org/2000/svg"
                                  fill="none"
                                  viewBox="0 0 22 22"
                                  width="20"
                                  height="20"
                                >
                                  <path
                                    stroke="currentColor"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="3"
                                    d="m4.67 10.424 4.374 4.748 8.478-7.678"
                                  ></path>
                                </svg>
                              ) : (
                                <img
                                  src="img://Copy.svg"
                                  alt={t("models.copy")}
                                  width="20"
                                  height="20"
                                />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  {errors[key] && (
                    <div className="error-message">{errors[key]}</div>
                  )}
                </div>
              )
          )}
          <div className="models-key-form-group">
            <label className="models-key-field-title">
              <>
                <div className="models-key-field-optional">
                  <CheckBox
                    checked={showOptional[provider]?.customModelID}
                    onChange={() =>
                      setShowOptional((prev) => ({
                        ...prev,
                        [provider]: { ...prev[provider], customModelID: !prev[provider]?.customModelID },
                      }))
                    }
                  ></CheckBox>
                  <>{`Custom Model ID${t("models.optional")}`}</>
                </div>
              </>
            </label>
            {showOptional[provider]?.customModelID && (
              <input
                type={"text"}
                value={(customModelID as string) || ""}
                onChange={(e) => setCustomModelID(e.target.value)}
                placeholder={"YOUR_MODEL_ID"}
                className={errors["customModelID"] ? "error" : ""}
              />
            )}
          </div>
        </div>
      </PopupConfirm>
    </>
  );
};
export default React.memo(KeyPopupEdit);
