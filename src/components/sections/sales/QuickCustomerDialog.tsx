import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
  customerDialog: boolean
  setCustomerDialog: (v: boolean) => void
  customerForm: { name: string; phone: string }
  setCustomerForm: (v: { name: string; phone: string }) => void
  saveCustomerPending: boolean
  onSave: () => void
}

export function QuickCustomerDialog({ customerDialog, setCustomerDialog, customerForm, setCustomerForm, saveCustomerPending, onSave }: Props) {
  return (
      <Dialog open={customerDialog} onOpenChange={v => !saveCustomerPending && setCustomerDialog(v)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>إضافة عميل سريع</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>الاسم *</Label>
              <Input
                value={customerForm.name}
                onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })}
              />
            </div>

            <div>
              <Label>الهاتف</Label>
              <Input
                value={customerForm.phone}
                onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })}
                dir="ltr"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomerDialog(false)} disabled={saveCustomerPending}>
              إلغاء
            </Button>
            <Button
              onClick={onSave}
              disabled={saveCustomerPending || !customerForm.name.trim()}
            >
              {saveCustomerPending ? 'جارٍ الحفظ...' : 'حفظ العميل'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  )
}
