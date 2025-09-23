import { useTranslation } from 'react-i18next';
import { Button, ButtonGroup, Card } from "react-bootstrap";
import { Copy, Lock, Pencil, PlusLg, Trash, Unlock } from "react-bootstrap-icons";
import { WICTemplate } from "@/types/common";

interface EditTemplateTableProps {
  namingTemplates: WICTemplate[];
  setNamingTemplates: (template: WICTemplate[]) => void;
  onAppendNewTemplate: () => void;
  onEditTemplateRow: (index: number) => void;
  onCopyTemplateRow: (index: number) => void;
}

const EditTemplateTable: React.FC<EditTemplateTableProps> = ({
  namingTemplates,
  setNamingTemplates,
  onAppendNewTemplate,
  onEditTemplateRow,
  onCopyTemplateRow
}) => {

  const { t } = useTranslation();

  const onDeleteTemplateRow = (index: number) => {
    // Clone existing templates and remove at specified index
    const updatedTemplates = [...namingTemplates];
    updatedTemplates.splice(index, 1);
    setNamingTemplates(updatedTemplates);
  };

  return (
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
                    <ButtonGroup size="sm">
                      <Button variant="outline-primary" title={t("edit")} onClick={() => onEditTemplateRow(index)}>
                        <Pencil />
                      </Button>
                      <Button variant="outline-success" title={t("copy")} onClick={() => onCopyTemplateRow(index)}>
                        <Copy />
                      </Button>
                      <Button variant="outline-danger" title={t("delete")} onClick={() => onDeleteTemplateRow(index)}>
                        <Trash />
                      </Button>
                    </ButtonGroup>
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
        <Button size="sm" variant="outline-primary" onClick={onAppendNewTemplate}>
          <PlusLg />
          {t("add")}
        </Button>
      </Card.Body>
    </Card>
  );
};

export default EditTemplateTable;
