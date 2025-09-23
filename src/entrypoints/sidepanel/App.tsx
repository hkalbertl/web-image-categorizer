import { Trans, useTranslation } from "react-i18next";
import { Navbar, Container, NavbarBrand, Form, Button, Alert, Spinner, InputGroup, DropdownButton, Dropdown, Badge } from "react-bootstrap";
import { CheckLg, ExclamationTriangle, Floppy, Lightbulb, QuestionCircle } from "react-bootstrap-icons";
import WCipher from "wcipher";
import { ENCRYPTION_EXT_NAME, MIME_TYPE_BINARY, SUPPORT_PROVIDER_TYPES } from "@/constants/common";
import { configBsTheme, loadConfig, initApiClient, dataUrlToArrayBuffer, encodeImage, getExtName, toDisplaySize, isValidForFileName, normalizeDirectoryPath } from "@/utils/common";

import '../../../node_modules/bootstrap/dist/css/bootstrap.min.css';
import './App.scss';


function App() {

  const { t } = useTranslation();

  const supportedImageFormats = [
    { mime: 'image/jpeg', extName: '.jpg', display: t("saveAsJpg") },
    { mime: 'image/png', extName: '.png', display: t("saveAsPng") },
    { mime: 'image/webp', extName: '.webp', display: t("saveAsWebp") }
  ];

  const [navbarProvider, setNavbarProvider] = useState<string>();
  const [showSetupTips, setShowSetupTips] = useState(false);
  const [showUsageTips, setShowUsageTips] = useState(false);
  const [isRetrieving, setIsRetrieving] = useState(false);

  // Preview image related
  const [previewImageUrl, setPreviewImageUrl] = useState<string>();
  const [displayFileExt, setDisplayFileExt] = useState('');
  const [originalFileExt, setOriginalFileExt] = useState('');
  const [originalImageBlob, setOriginalImageBlob] = useState<Blob>();
  const [activeImageBlob, setActiveImageBlob] = useState<Blob>();

  // Edit form relate
  const [showEditForm, setShowEditForm] = useState(false);
  const [imageDirectory, setImageDirectory] = useState('');
  const [imageFileName, setImageFileName] = useState('');
  const [imageDimension, setImageDimension] = useState('');
  const [imageFileSize, setImageFileSize] = useState('');
  const [useEncryption, setUseEncryption] = useState(false);
  const [allowEncryption, setAllowEncryption] = useState(false);

  // Validation related
  const [isSaving, setIsSaving] = useState(false);
  const [imageDirectoryError, setImageDirectoryError] = useState<string>();
  const [imageFileNameError, setImageFileNameError] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();

  /**
   * Reset layout.
   */
  const resetLayout = () => {
    // Hide tips
    setShowSetupTips(false);
    setShowUsageTips(false);
    setIsRetrieving(false);
    // Hide edit form
    setShowEditForm(false);
    setImageDirectoryError(undefined);
    setImageFileNameError(undefined);
    setSuccessMessage(undefined);
    setErrorMessage(undefined);
    // Clear image data
    if (previewImageUrl) {
      URL.revokeObjectURL(previewImageUrl);
    }
    setPreviewImageUrl(undefined);
    setOriginalImageBlob(undefined);
    setActiveImageBlob(undefined);
  };

  /**
   * Reset layout and refresh config
   */
  const refreshConfig = () => {
    // Reset layout
    resetLayout();
    // Load config
    loadConfig().then(config => {
      if (config && config.provider && config.provider.type) {
        // Config loaded
        const targetProviderType = config.provider.type,
          targetProviderEntry = SUPPORT_PROVIDER_TYPES.find(p => p.type === targetProviderType);
        if (targetProviderEntry) {
          setNavbarProvider(targetProviderEntry.display);
          // Show the usage tips
          setShowUsageTips(true);
        } else {
          console.warn('Config loaded but provider is not supported!?');
        }
      } else {
        // Show the setup tips
        setShowSetupTips(true);
      }
    });
  };

  /**
   * Load image and show edit form.
   * @param blobArray The image blob data.
   * @param blobType The content type of blob, such as "image/png".
   * @param dimension Optional. The dimension of image.
   * @param displaySize
   * @param targetDirectory
   * @param targetFileName
   * @param targetExtension
   * @param useEncryption
   */
  const fillImageData = async (
    blobArray: ArrayBuffer,
    blobType: string,
    dimension: string,
    displaySize: string,
    targetDirectory: string,
    targetFileName: string,
    targetExtension: string,
    useEncryption: boolean
  ) => {
    // Reset layout
    resetLayout();

    // Check API key defined
    const config = await loadConfig();
    if (!config || !config.provider) {
      console.warn('Provider is not defined...');
      setShowSetupTips(true);
      return;
    }

    let allowEdit = false;
    try {
      if (blobArray && blobType) {
        // Save original image data
        setOriginalImageBlob(new Blob([blobArray], { type: blobType }));
        // Restore blob data
        const blobData = new Blob([blobArray], { type: blobType });
        const imageUrl = URL.createObjectURL(blobData);
        setActiveImageBlob(blobData);
        setPreviewImageUrl(imageUrl);
        allowEdit = true;
      } else {
        // Unknown format
        setErrorMessage('Failed to retrieve image...');
      }
    } catch (ex) {
      setErrorMessage(`Failed to retrieve image: ${ex}`);
    }

    // When image loaded
    if (allowEdit) {
      // Set directory
      setImageDirectory(targetDirectory);

      // Split the file name and extension
      setImageFileName(targetFileName);

      setDisplayFileExt(targetExtension);
      setOriginalFileExt(targetExtension);
      // activeFileExt = targetExtension;

      // Add file dimension and size
      setImageDimension(dimension || '');
      setImageFileSize(displaySize || '');

      // Config encryption
      if (config.wcipherPassword) {
        setAllowEncryption(true);
        setUseEncryption(useEncryption);
      } else {
        // Encryption not available
        setAllowEncryption(false);
        setUseEncryption(false);
      }

      // Show edit panel and form
      setShowEditForm(true);
    }
  };

  /**
   * Handle image format changed.
   * @param imageFormat The image format, such as "origial" or target image mime type.
   */
  const onImageFormatChanged = async (imageFormat: string) => {
    if (imageFormat && originalImageBlob) {
      // Clean up
      if (previewImageUrl) {
        URL.revokeObjectURL(previewImageUrl);
      }
      setActiveImageBlob(undefined);
      // Check format to change
      let imageBlob: Blob | null = null;
      if ('original' === imageFormat) {
        // Switch back to original format
        const arrayBuffer = await originalImageBlob.arrayBuffer();
        imageBlob = new Blob([arrayBuffer], { type: originalImageBlob.type });
        // Use original extension name
        setDisplayFileExt(originalFileExt);
      } else if (imageFormat.startsWith('image/')) {
        // Encode image
        imageBlob = await encodeImage(originalImageBlob, imageFormat);
        // Update imagefile  extension
        setDisplayFileExt(`.${getExtName(imageFormat)}`);
      }
      if (imageBlob) {
        setActiveImageBlob(imageBlob);
        // Convert encoded, set to preview
        setPreviewImageUrl(URL.createObjectURL(imageBlob));
        // Update image size
        setImageFileSize(toDisplaySize(imageBlob.size));
      }
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Reset error messages
    setImageDirectoryError(undefined);
    setImageFileNameError(undefined);
    setErrorMessage(undefined);
    setSuccessMessage(undefined);

    // Validate form
    let isValid = true, trimmedDirectory = normalizeDirectoryPath(imageDirectory);
    if (!trimmedDirectory) {
      setImageDirectoryError(t("fieldRequired"));
      isValid = false;
    } else if ('/' !== trimmedDirectory.charAt(0)) {
      setImageDirectoryError(t("directoryStartWithSlash"));
      isValid = false;
    } else {
      // Check each folder name
      const folders = trimmedDirectory.substring(1).split('/');
      if (!folders.every(isValidForFileName)) {
        setImageDirectoryError(t("invalidCharacters"));
        isValid = false;
      }
    }
    const trimmedFileName = imageFileName.trim();
    if (!trimmedFileName) {
      setImageFileNameError(t("fieldRequired"));
      isValid = false;
    } else if (!isValidForFileName(trimmedFileName)) {
      setImageFileNameError(t("invalidCharacters"));
      isValid = false;
    }
    if (!isValid) {
      return false;
    }

    // Check storage provider
    const appConfig = await loadConfig();
    const api = initApiClient(appConfig.provider);
    if (!api) {
      // Unknown provider
      setErrorMessage(t("invalidProviderOptions") + (appConfig.provider?.type || 'Unknown'));
      return false;
    }

    // Prepare to upload
    setIsSaving(true);
    try {
      let fileName = `${trimmedFileName}${displayFileExt}`;
      let uploadBlob: Blob = activeImageBlob!;

      if (useEncryption && appConfig.wcipherPassword) {
        // Use WCipher for encryption
        const imageBytes = await uploadBlob.arrayBuffer();
        const encryptedBytes = await WCipher.encrypt(appConfig.wcipherPassword, new Uint8Array<ArrayBuffer>(imageBytes));
        uploadBlob = new Blob([encryptedBytes as Uint8Array<ArrayBuffer>], { type: MIME_TYPE_BINARY });
        // Append file extension
        fileName += ENCRYPTION_EXT_NAME;
      }

      // Upload file
      const fileRef = await api.uploadFile(trimmedDirectory, fileName, uploadBlob);
      console.debug(`File uploaded: ${fileRef}`);

      // Set success message and hide edit form
      setSuccessMessage(t("imageUploaded"));
      setShowEditForm(false);
    } catch (ex) {
      setErrorMessage(t("failedToUploadFile") + getErrorMessage(ex));
    } finally {
      setIsSaving(false);
    }
    return false;
  };

  useEffect(() => {
    // Config theme
    configBsTheme();
    // Load config
    refreshConfig();
    // Listen for changes in storage
    browser.storage.onChanged.addListener((_, area) => {
      if ("sync" === area) {
        refreshConfig();
      }
    });
    // Register event listener
    browser.runtime.onMessage.addListener(async (message: any) => {
      if (!isSaving) {
        // Handle messages only when sidebar is idle
        if ('reload-sidebar' === message.action) {
          // Reload to apply config
          self.location.reload();
        } else if ('prepare-image' === message.action) {
          // Reset layout and just show retrieving
          resetLayout();
          setIsRetrieving(true);
        } else if ('fill-image' === message.action) {
          // Check image data
          let blobArray: ArrayBuffer;
          if (message.imageData instanceof ArrayBuffer) {
            // FireFox
            blobArray = message.imageData;
          } else {
            // Chrome, decode the data URL
            blobArray = dataUrlToArrayBuffer(message.imageData as string);
          }
          // Image sent from background / content
          await fillImageData(blobArray, message.imageType, message.dimension, message.displaySize,
            message.directory, message.fileName, message.extension, message.useEncryption);
        } else if ('show-error' === message.action) {
          // Problem occurred in background script, hide elements
          resetLayout();
          setErrorMessage(message.error);
        }
      }
      // Return true to indicate the response is asynchronous (optional)
      return true;
    });
  }, []);

  return (<>
    <Navbar expand>
      <Container fluid>
        <NavbarBrand>
          {t("appShortName")}
          {navbarProvider && <Badge pill bg="info">{navbarProvider}</Badge>}
        </NavbarBrand>
        <Form>
          <Button variant="outline-secondary" title={t("help")} target="_blank"
            href="https://github.com/hkalbertl/web-image-categorizer/wiki">
            <QuestionCircle />
          </Button>
        </Form>
      </Container>
    </Navbar>
    <main className="container-fluid">
      {showSetupTips &&
        <Alert variant="warning">
          <Lightbulb width={18} height={18} />
          <Trans
            i18nKey="configureTips"
            components={[<a href="options.html" target="_blank" rel="noopener noreferrer" />]}
          />
        </Alert>
      }
      {showUsageTips &&
        <Alert variant="info">
          <Lightbulb width={18} height={18} />
          <Trans
            i18nKey="usageTips"
            components={[<code />]}
          />
        </Alert>
      }
      {isRetrieving &&
        <Alert variant="info">
          <Spinner animation="border" size="sm" />
          {t("retrievingImage")}
        </Alert>
      }
      {previewImageUrl &&
        <div>
          <div id="cloud-image-container" className="mb-3">
            <img id="cloud-image" alt="" src={previewImageUrl} />
          </div>
          {showEditForm &&
            <Form autoComplete="off" noValidate onSubmit={handleFormSubmit}>
              <Form.Group controlId="cloud-directory">
                <Form.Label>{t("directory")}</Form.Label>
                <Form.Control type="text" max={500}
                  className={imageDirectoryError ? 'is-invalid' : ''} isInvalid={!!imageDirectoryError}
                  value={imageDirectory} onInput={e => setImageDirectory(e.currentTarget.value)}
                />
                <Form.Control.Feedback type="invalid">{imageDirectoryError}</Form.Control.Feedback>
              </Form.Group>
              <Form.Group controlId="cloud-file-name">
                <Form.Label>{t("fileName")}</Form.Label>
                <InputGroup>
                  <Form.Control type="text" max={200}
                    className={imageFileNameError ? 'is-invalid' : ''} isInvalid={!!imageFileNameError}
                    value={imageFileName} onInput={e => setImageFileName(e.currentTarget.value)}
                  />
                  <InputGroup.Text>{displayFileExt}</InputGroup.Text>
                  <Dropdown>
                    <Dropdown.Toggle variant="outline-secondary" className="rounded-end"></Dropdown.Toggle>
                    <Dropdown.Menu align="end">
                      {supportedImageFormats.map((format, index) => (
                        <Dropdown.Item key={index} onClick={() => onImageFormatChanged(format.mime)}>
                          {format.display}
                        </Dropdown.Item>
                      ))}
                      <Dropdown.Divider />
                      <Dropdown.Item onClick={() => onImageFormatChanged('original')}>
                        {t("useOriginalFormat")}
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown>
                  <Form.Control.Feedback type="invalid">{imageFileNameError}</Form.Control.Feedback>
                </InputGroup>
              </Form.Group>
              <Form.Group controlId="cloud-file-info">
                <Form.Label>
                  {t("fileInfo")}
                  <Badge bg="info">{t("forReferenceOnly")}</Badge>
                </Form.Label>
                <InputGroup>
                  <Form.Control type="text" value={imageDimension} readOnly />
                  <Form.Control type="text" value={imageFileSize} readOnly />
                </InputGroup>
              </Form.Group>
              <Form.Check
                type="switch"
                id="cloud-file-encryption"
                label="Use client-side encryption"
                className="mb-3"
                disabled={!allowEncryption}
                checked={useEncryption}
                onChange={e => setUseEncryption(e.currentTarget.checked)}
              />
              <Button type="submit" variant="primary" disabled={isSaving}>
                {isSaving ? <Spinner size="sm" /> : <Floppy />}
                {t("save")}
              </Button>
            </Form>
          }
        </div>
      }
      {errorMessage &&
        <Alert variant="danger">
          <ExclamationTriangle />
          {errorMessage}
        </Alert>
      }
      {successMessage &&
        <Alert variant="success">
          <CheckLg />
          {successMessage}
        </Alert>
      }
    </main>
  </>);
}

export default App;
