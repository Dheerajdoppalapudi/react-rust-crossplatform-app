import { Box, Typography, Paper, Switch, Divider } from '@mui/material'

const settingsItems = [
  { label: 'Email Notifications', desc: 'Receive email updates about your account activity.' },
  { label: 'Two-Factor Authentication', desc: 'Add an extra layer of security to your account.' },
  { label: 'Auto Updates', desc: 'Automatically install the latest updates.' },
]

const Settings = () => {
  return (
    <Box>
      <Typography variant="h4" fontWeight={600} gutterBottom>
        Settings
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 600 }}>
        Manage your account preferences and configurations.
      </Typography>
      <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid #e0e0e0' }}>
        {settingsItems.map((item, index) => (
          <Box key={item.label}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 3 }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={500}>
                  {item.label}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {item.desc}
                </Typography>
              </Box>
              <Switch color="primary" />
            </Box>
            {index < settingsItems.length - 1 && <Divider />}
          </Box>
        ))}
      </Paper>
    </Box>
  )
}

export default Settings
