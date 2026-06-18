# Changes to Implement

## Change 1 - Fix Password
- Update Login.tsx: password should be '*@Tlb120720' (not 'senha(*@Tlb120720)')

## Change 2 - WhatsApp Reminder Icon
- Make the reminder sent indicator (checkmark) more visually prominent and slightly larger
- When clicking 'Renovar', automatically clear the lembreteEnviado flag (set to false)
- Use a more eye-catching icon/style for the reminder indicator

## Change 3 - Renew Button Redesign
- Replace the dropdown with 2 buttons:
  - 'Mensal' button: adds exactly 30 days to vencimento
  - 'Personalizado' button: opens a small input/modal where user types number of months, then confirms
- Keep the existing renewal logic but adapt to these 2 options

## Change 4 - Enhanced Financial Dashboard
- Add fields to FinancialSummary:
  - 'Despesas': sum of all server costs from settings
  - 'Receita Bruta': sum of client values for renewals done THIS MONTH only (considering multi-month renewals - only count the portion for this month, or count full value in the month of renewal and 0 in subsequent months)
  - 'Resultado': Receita Bruta - Despesas
- Add month selector to view last 3 months for comparison
- Track renewal history per client to calculate monthly revenue correctly

## Change 5 - Advanced Filter for Early Reminders
- Add a filter or view to show clients expiring in 2+ days from today
- Allow user to set how many days ahead to look (e.g., 2, 3, 5 days)
- These clients can receive early reminders before the standard 1-day reminder

## Change 6 - Custom Template Variables in Settings
- In Settings, add a section 'Variaveis Personalizadas'
- Allow user to add custom key-value pairs: key (placeholder name) and value
- Example: key='empresa', value='Minha Empresa LTDA'
- These variables can be used in WhatsApp templates as {empresa}
- Store in settings as Record<string, string>
- Update buildWhatsAppUrl to replace all custom variables

## Requirements
- Read existing files first
- Do NOT break existing functionality
- Run npx tsc --noEmit and npx vite build after
- All UI text in Brazilian Portuguese
