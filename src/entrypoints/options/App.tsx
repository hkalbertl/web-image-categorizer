import { useTranslation, Trans } from 'react-i18next';
import { Alert, Button, Card, Col, Container, Dropdown, DropdownButton, Form, Nav, Navbar, NavbarBrand, Row, Tab, Tabs } from 'react-bootstrap';
import { Floppy, Gear, InfoCircle, Lock, Pencil, PlusLg, Power, QuestionCircle, Trash, Unlock } from 'react-bootstrap-icons';
import { MessageModalMode, WICConfig, WICImageFormat, WICProviderType, WICTemplate } from '@/types/common';
import EditTemplateModal from '@/components/EditTemplateModal';
import MessageModal from '@/components/MessageModal';
import StorageProvider from '@/services/StorageProvider';
import PasswordField from '@/components/PasswordField';
import FileLuApi from '@/services/FileLuApi';
import S3Api from '@/services/S3Api';
import { configBsTheme, getErrorMessage, loadConfig, openSidebar, getNowString } from '@/utils/common';
import { DEFAULT_CONFIG, SUPPORT_IMAGE_TYPES } from '@/constants/common';

import '../../../node_modules/bootstrap/dist/css/bootstrap.min.css';
import './App.scss';

function App() {

  const { t } = useTranslation();

  const [windowId, setWindowId] = useState(0);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  // On screen input binding
  const [providerType, setProviderType] = useState<WICProviderType>('FileLu');
  const [fileLuApiKey, setFileLuApiKey] = useState<string>('');
  const [s3AccessId, setS3AccessId] = useState<string>('');
  const [s3SecretKey, setS3SecretKey] = useState<string>('');
  const [encPassword, setEncPassword] = useState<string>('');
  const [sidebarMode, setSidebarMode] = useState(0);
  const [notificationLevel, setNotificationLevel] = useState(4);
  const [imageFormat, setImageFormat] = useState<WICImageFormat>(SUPPORT_IMAGE_TYPES[0].mime);

  // Validation related
  const [fileLuApiKeyError, setFileLuApiKeyError] = useState<string | undefined>();
  const [s3AccessIdError, setS3AccessIdError] = useState<string | undefined>();
  const [s3SecretKeyError, setS3SecretKeyError] = useState<string | undefined>();

  // Naming template related
  const [namingTemplates, setNamingTemplates] = useState<WICTemplate[]>([]);
  const [templateForEdit, setTemplateForEdit] = useState<WICTemplate | undefined>();
  const [editingTemplateIndex, setEditingTemplateIndex] = useState<number>(-1);
  const [showEditTemplateModal, setShowEditTemplateModal] = useState(false);

  // Message modal
  const [showMsgModal, setShowMsgModal] = useState(false);
  const [msgModalMode, setMsgModalMode] = useState<MessageModalMode>('progress');
  const [msgModalText, setMsgModalText] = useState<string>();

  /**
   * Put specified config values on screen.
   */
  const applyConfigOnScreen = (config: WICConfig) => {
    if (config.provider) {
      setProviderType(config.provider.type);
      if ('FileLu' === config.provider.type) {
        setFileLuApiKey(config.provider.apiKey || '');
      } else if ('S3' === config.provider.type) {
        setS3AccessId(config.provider.accessId || '');
        setS3SecretKey(config.provider.secretKey || '');
      }
    }
    if (Array.isArray(config.templates)) {
      setNamingTemplates(config.templates);
    }
    setEncPassword(config.wcipherPassword || '');
    setSidebarMode(config.sidebarMode);
    setNotificationLevel(config.notificationLevel);
    setImageFormat(config.imageFormat);
  }

  const appendNewTemplate = () => {
    setTemplateForEdit(undefined);
    setEditingTemplateIndex(-1);
    setShowEditTemplateModal(true);
  };

  const editTemplateAtRow = (index: number) => {
    setTemplateForEdit(namingTemplates[index]);
    setEditingTemplateIndex(index);
    setShowEditTemplateModal(true);
  };

  const onApplyTemplate = (template: WICTemplate) => {
    // Close modal
    setShowEditTemplateModal(false);
    // Check edit mode
    let editedTemplates: WICTemplate[];
    if (-1 === editingTemplateIndex) {
      // Append template
      editedTemplates = [...namingTemplates, template];
    } else {
      // Edit template
      editedTemplates = [...namingTemplates];
      editedTemplates[editingTemplateIndex] = template;
    }
    setNamingTemplates(editedTemplates);
  };

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Reset layout
    setFileLuApiKeyError(undefined);
    setS3AccessIdError(undefined);
    setS3SecretKeyError(undefined);

    // Validate inputs
    let isValid = true;
    if ('FileLu' === providerType) {
      if (!fileLuApiKey) {
        setFileLuApiKeyError(t("fieldRequired"));
        isValid = false;
      }
    } else if ('S3' === providerType) {
      if (!s3AccessId) {
        setS3AccessIdError(t("fieldRequired"));
        isValid = false;
      }
      if (!s3SecretKey) {
        setS3SecretKeyError(t("fieldRequired"));
        isValid = false;
      }
    }
    if (!isValid) {
      return false;
    }

    // Put all input values to config object
    const config = { ...DEFAULT_CONFIG };
    config.provider = {
      type: providerType,
      apiKey: fileLuApiKey,
      accessId: s3AccessId,
      secretKey: s3SecretKey,
    };
    config.wcipherPassword = encPassword;
    config.templates = [...namingTemplates];
    config.sidebarMode = sidebarMode ? 1 : 0;
    config.notificationLevel = notificationLevel;
    config.imageFormat = imageFormat;

    // Show loading
    setMsgModalMode("progress");
    setMsgModalText(t("validatingOptions"));
    setShowMsgModal(true);

    // Initialize storage provider
    let api: StorageProvider;
    if ('FileLu' === config.provider.type) {
      api = new FileLuApi(fileLuApiKey!);
    } else if ('S3' === config.provider.type) {
      api = new S3Api(s3AccessId!, s3SecretKey!);
    } else {
      // Unknown provider??
      setMsgModalMode("failed");
      setMsgModalText(t("unknownProviderType") + config.provider.type);
      return false;
    }

    // Open sidebar, if enabled
    if (0 !== config.sidebarMode) {
      openSidebar(windowId);
    }

    // Test provider settings
    api.validateCredentials().then(success => {
      if (success) {
        // Valid config, save to storage
        browser.storage.sync.set(config);
        setMsgModalMode("success");
        setMsgModalText(t("optionsSaved"));
      } else {
        // Invalid credentials
        setMsgModalMode("failed");
        setMsgModalText(t("invalidCredentials"));
      }
    }).catch(err => {
      // Unhandled error
      setMsgModalMode("failed");
      setMsgModalText(getErrorMessage(err));
    });
    return false;
  };

  const onExport = async () => {
    let downloadUrl: string | undefined = undefined;
    try {
      // Load saved config
      const savedConfig = await loadConfig();
      // Prepare export config content
      const exportConfig = {
        version: 1,
        ...savedConfig,
      };
      if (savedConfig.provider) {
        // Just keep the provider type
        exportConfig.provider = {
          type: savedConfig.provider.type
        };
      }
      // Remove password
      delete exportConfig.wcipherPassword;
      // Prepare download blob
      const exportJson = JSON.stringify(exportConfig);
      const exportBlob = new Blob([exportJson], { type: "application/json" });
      downloadUrl = URL.createObjectURL(exportBlob);
      // Prompt for download
      await browser.downloads.download({
        url: downloadUrl!,
        filename: `wic-options-${getNowString()}.json`,
        saveAs: true, // prompts user to pick location
      });
    } finally {
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
    }
  };

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setMsgModalMode('progress');
    setMsgModalText(t("validatingOptionsFile"));
    setShowMsgModal(true);
    try {
      // Prepare config variable and read the input file
      const importConfig: WICConfig = { ...DEFAULT_CONFIG };
      const rawText = await selectedFile.text();
      const rawJson = JSON.parse(rawText);

      if (!rawJson.version || !isFinite(rawJson.version) || isNaN(rawJson.version) || 1 !== +rawJson.version) {
        // Missing or unknown version
        throw new Error('Missing or unknown version.');
      }

      if (!rawJson.provider || 'object' !== typeof rawJson.provider
        || 'string' !== typeof rawJson.provider.type
        || !['FileLu', 'S3'].includes(rawJson.provider.type)) {
        // Missing or unknown provider type
        throw new Error('Missing or unknown provider type.');
      }
      importConfig.provider = {
        type: rawJson.provider.type
      };

      // Validate templates
      if (rawJson.templates) {
        if (!Array.isArray(rawJson.templates)) {
          // Non array templates detected
          throw new Error('Unknown templates.');
        } else if (rawJson.templates.length) {
          importConfig.templates = [];
          for (const item of rawJson.templates) {
            if (!item.url || 'string' !== typeof item.url || 0 === item.url.length) {
              throw new Error('Missing or unknown template URL.');
            }
            if (item.directory && 'string' !== typeof item.directory) {
              throw new Error('Unknown template directory.');
            }
            if (item.fileName && 'string' !== typeof item.fileName) {
              throw new Error('Unknown template file name.');
            }
            if ('boolean' !== typeof item.encryption) {
              throw new Error('Unknown template encryption.');
            }
            importConfig.templates.push({
              url: item.url,
              directory: item.directory || undefined,
              fileName: item.fileName || undefined,
              encryption: item.encryption || false,
            } as WICTemplate);
          }
        }
      }

      if ('number' !== typeof rawJson.sidebarMode || 0 > rawJson.sidebarMode || 1 < rawJson.sidebarMode) {
        throw new Error('Missing or unknown sidebar mode.');
      }
      importConfig.sidebarMode = rawJson.sidebarMode;

      if (0 === importConfig.sidebarMode) {
        if ('number' !== typeof rawJson.notificationLevel || 0 > rawJson.notificationLevel || 4 < rawJson.notificationLevel) {
          throw new Error('Missing or unknown notification level.');
        }
        importConfig.notificationLevel = rawJson.notificationLevel;
      }

      if (!rawJson.imageFormat || 'string' !== typeof rawJson.imageFormat
        || !SUPPORT_IMAGE_TYPES.some(im => im.mime === rawJson.imageFormat)) {
        throw new Error('Missing or unknown template image format.');
      }
      importConfig.imageFormat = rawJson.imageFormat;

      // Config valid!
      applyConfigOnScreen(importConfig);
      setMsgModalText(t("optionsLoadedAndChooseProvider"));
      setMsgModalMode('success');

    } catch (ex) {
      console.error('Failed to import: ', ex);
      setMsgModalText(t("failedToImportOptions") + getErrorMessage(ex));
      setMsgModalMode('failed');
    }
  };

  const onReset = async () => {
    if (confirm(t('confirmResetOptions'))) {
      // Clear all settings
      await browser.storage.sync.clear();
      // Send reload sidebar message
      browser.runtime.sendMessage({ action: 'reload-sidebar' }).catch(err => {
        console.warn('Failed to send reload sidebar message: ' + getErrorMessage(err));
      });
      // Reload current option page
      self.location.reload();
    }
  }

  /**
   * Set theme and load saved config.
   */
  useEffect(() => {
    // Config theme
    configBsTheme();
    // Get windowId for chrome
    if (browser.windows && browser.sidePanel) {
      browser.windows.getCurrent().then(window => {
        setWindowId(window.id!);
      });
    }
    // Load config
    loadConfig().then(savedConfig => {
      applyConfigOnScreen(savedConfig);
    });
  }, []);

  return (<>
    <Navbar expand>
      <Container fluid="md">
        <NavbarBrand>
          <img alt={t("appShortName")} src="icon/32.png" width="30" className="d-inline-block align-top" />
          {t("appName")}
        </NavbarBrand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto">
            <Nav.Link href="https://github.com/hkalbertl/web-image-categorizer/wiki" target="_blank">
              <QuestionCircle />
              {t("help")}
            </Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>

    <Form className="pt-3 option-form" autoComplete="off" noValidate onSubmit={onFormSubmit}>
      <Row>
        <Col sm="2" md="3" className="pb-3 pb-sm-0">{t("storageProviders")}</Col>
        <Col sm="10" md="9">
          <Tabs id="storage-provider" defaultActiveKey={providerType} activeKey={providerType}
            onSelect={selected => setProviderType(selected as WICProviderType)}
          >
            <Tab eventKey="FileLu" title="FileLu API">
              <Tab.Content className="border border-top-0 p-3">
                <Form.Group as={Row} controlId="filelu-api-key">
                  <Form.Label column sm={3}>{t("apiKey")}</Form.Label>
                  <Col sm={9}>
                    <PasswordField password={fileLuApiKey} onInput={setFileLuApiKey} invalidMsg={fileLuApiKeyError} />
                    <Form.Text className="d-block">
                      <Trans
                        i18nKey="enableFileLuApiKeyAtMyAccount"
                        components={[<a href="https://filelu.com/account/" target="_blank" />]}
                      />
                    </Form.Text>
                    <Form.Text>
                      <Trans
                        i18nKey="suggestFileLuReferral"
                        components={[<a href="https://filelu.com/5155514948.html" target="_blank" />]}
                      />
                    </Form.Text>
                  </Col>
                </Form.Group>
              </Tab.Content>
            </Tab>
            <Tab eventKey="S3" title="(Coming Soon) FileLu S5 / AWS S3" disabled>
              <Tab.Content className="border border-top-0 p-3">
                <Alert variant="info">
                  <InfoCircle />
                  &nbsp;Connect by using FileLu S5 API, which is an AWS S3 compatible API.
                </Alert>
                <Form.Group as={Row} controlId="s3-access-id">
                  <Form.Label column sm={3}>{t("accessId")}</Form.Label>
                  <Col sm={9}>
                    <Form.Control type="text" maxLength={50} isInvalid={!!s3AccessIdError}
                      value={s3AccessId} onInput={e => setS3AccessId(e.currentTarget.value)}
                    />
                    <Form.Control.Feedback type="invalid">
                      {s3AccessIdError}
                    </Form.Control.Feedback>
                  </Col>
                </Form.Group>
                <Form.Group as={Row} controlId="s3-secret-key">
                  <Form.Label column sm={3}>{t("secretKey")}</Form.Label>
                  <Col sm={9}>
                    <PasswordField password={s3SecretKey} onInput={setS3SecretKey} invalidMsg={s3SecretKeyError} />
                  </Col>
                </Form.Group>
              </Tab.Content>
            </Tab>
          </Tabs>
        </Col>
      </Row>
      <Row>
        <Col sm="2" md="3" className="pb-3 pb-sm-0">{t("privacy")}</Col>
        <Col sm="10" md="9">
          <Form.Group className="mb-3" controlId="enc-password">
            <Form.Label>{t("encryptionPassword")}</Form.Label>
            <PasswordField password={encPassword} onInput={setEncPassword} />
            <Form.Text>
              <Trans
                i18nKey="encryptionPasswordHelpText"
                components={[<a href="https://github.com/hkalbertl/wcipher" target="_blank" />]}
              />
            </Form.Text>
          </Form.Group>
        </Col>
      </Row>
      <Row>
        <Col sm="2" md="3" className="pb-3 pb-sm-0">{t("namingTemplates")}</Col>
        <Col sm="10" md="9">
          <Card>
            <Card.Body>
              <table className="table table-hover template-table">
                <thead>
                  <tr>
                    <td colSpan={2}>{t("urls")}</td>
                  </tr>
                </thead>
                {0 !== namingTemplates.length &&
                  <tbody>
                    {namingTemplates.map((template, index) => (
                      <tr key={index}>
                        <td>{template.encryption ? <Lock className="text-success" /> : <Unlock />}{template.url}</td>
                        <td className="text-end">
                          <Button variant="primary" size="sm" className="no-text" title={t("edit")} onClick={() => editTemplateAtRow(index)}>
                            <Pencil />
                          </Button>
                          <Button variant="danger" size="sm" className="no-text" title={t("delete")}>
                            <Trash />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                }
                {0 === namingTemplates.length &&
                  <tfoot>
                    <tr>
                      <td className="text-center fst-italic" colSpan={2}>({t("noRecords")})</td>
                    </tr>
                  </tfoot>
                }
              </table>
              <Button size="sm" variant="outline-primary" onClick={appendNewTemplate}>
                <PlusLg />
                {t("add")}
              </Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      <Row>
        <Col sm="2" md="3" className="pb-3 pb-sm-0">{t("others")}</Col>
        <Col sm="10" md="9" className="field-list">
          <Form.Group controlId="sidebar-mode">
            <Form.Label>Use of Sidebar</Form.Label>
            <Form.Select value={sidebarMode ? "1" : "0"} onChange={e => setSidebarMode(+e.currentTarget.value)}>
              <option value="0">Disabled, save images to cloud directly</option>
              <option value="1">Enabled, edit the directory or file name before saving</option>
            </Form.Select>
            <Form.Text>
              You can enable sidebar to show the edit form for target directory and file name before saving.
            </Form.Text>
          </Form.Group>
          {!sidebarMode &&
            <Form.Group controlId="notification-level">
              <Form.Label>Notifications</Form.Label>
              <Form.Select value={`${notificationLevel}`} onChange={e => setNotificationLevel(+e.currentTarget.value)}>
                <option value="4">Allow all notifications</option>
                <option value="3">Notify when image saved or error occurred</option>
                <option value="2">Notify only when errors ocurred</option>
                <option value="1">Disabled (You have to check the result manually on provider)</option>
              </Form.Select>
              <Form.Text>
                Notifications are available when sidebar is disabled.
              </Form.Text>
            </Form.Group>
          }
          <Form.Group controlId="image-format">
            <Form.Label>Fallback Image Format</Form.Label>
            <Form.Select value={imageFormat} onChange={e => setImageFormat(e.currentTarget.value as WICImageFormat)}>
              {SUPPORT_IMAGE_TYPES.map((item, index) => (
                <option key={index} value={item.mime}>{item.selectText}</option>
              ))}
            </Form.Select>
            <Form.Text>
              If an image cannot be downloaded in its original format, WIC will use an alternative method to download and save it in the specified format.
            </Form.Text>
          </Form.Group>
        </Col>
      </Row>
      <Row>
        <Col sm="2" md="3"></Col>
        <Col sm="10" md="9">
          <div className="d-flex gap-2 mb-3">
            <Button variant="primary" type="submit" className="me-auto">
              <Floppy />
              {t("save")}
            </Button>
            <input
              type="file"
              accept="application/json"
              ref={importInputRef}
              onChange={onImport}
              className="d-none"
            />
            <DropdownButton variant="outline-secondary" title={<><Gear />{t("options")}</>} align="end">
              <Dropdown.Item onClick={() => {
                importInputRef.current!.value = '';
                importInputRef.current!.click();
              }}>Import from file</Dropdown.Item>
              <Dropdown.Item onClick={onExport}>Export to file, excluded API keys / secrets</Dropdown.Item>
            </DropdownButton>
            <Button variant="outline-danger" onClick={onReset}>
              <Power />
              {t("reset")}
            </Button>
          </div>
        </Col>
      </Row>
    </Form>

    <EditTemplateModal
      show={showEditTemplateModal}
      template={templateForEdit}
      onClose={() => { setShowEditTemplateModal(false) }}
      onSave={onApplyTemplate}
    />

    <MessageModal
      show={showMsgModal}
      mode={msgModalMode}
      message={msgModalText}
      onClose={() => setShowMsgModal(false)}
    />
  </>);
}

export default App;
