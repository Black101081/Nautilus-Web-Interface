# Integration Checklist

Use this checklist to integrate Sprint 5 deliverables into your Nautilus Trader Admin project.

## Pre-Integration

- [ ] Backup your current project
- [ ] Create a new git branch for integration
- [ ] Review all files in this package
- [ ] Read README.md thoroughly

## Core System Integration

### Step 1: Notification System

- [ ] Copy `contexts/NotificationContext.tsx` to `client/src/contexts/`
- [ ] Copy `components/NotificationContainer.tsx` to `client/src/components/`
- [ ] Copy `utils/testHelper.ts` to `client/src/utils/`
- [ ] Update `App.tsx` with NotificationProvider wrapper
- [ ] Add notification animations to `index.css`
- [ ] Verify imports resolve correctly

### Step 2: Build Configuration

- [ ] Copy `vite.config.staging.ts` to project root
- [ ] Merge `package.json` scripts section
- [ ] Run `pnpm install` to ensure dependencies
- [ ] Test staging build: `pnpm run build:staging`

### Step 3: Page Updates

- [ ] Copy `pages/DatabasePage.tsx` to `client/src/pages/admin/`
- [ ] Copy `pages/AdminDashboard.tsx` to `client/src/pages/admin/`
- [ ] Copy `pages/ComponentShowcase.tsx` to `client/src/pages/admin/`
- [ ] Copy `pages/ComponentsPage.tsx` to `client/src/pages/admin/`
- [ ] Copy `pages/FeaturesPage.tsx` to `client/src/pages/admin/`
- [ ] Verify all page imports resolve

### Step 4: Test Pages (Optional)

- [ ] Copy `pages/NotificationTest.tsx` (for testing)
- [ ] Copy `pages/DirectEventTest.tsx` (for debugging)
- [ ] Add routes in App.tsx if needed
- [ ] Can be removed after testing

## Testing

### Build Test

- [ ] Run `pnpm run build:staging`
- [ ] Verify no TypeScript errors
- [ ] Verify no build warnings
- [ ] Check bundle size is reasonable

### Manual Testing

- [ ] Start development server: `pnpm run dev`
- [ ] Navigate to Database page
- [ ] Click "Optimize" button
- [ ] Verify notification appears in top-right corner
- [ ] Verify notification auto-dismisses after 5 seconds
- [ ] Test all 4 notification types (success, error, warning, info)

### Page-by-Page Testing

**Database Page:**
- [ ] Test PostgreSQL operations
- [ ] Test Parquet operations
- [ ] Test Redis operations
- [ ] Test table view operations
- [ ] Test maintenance operations

**Dashboard Page:**
- [ ] Test component management (Stop, Restart, Configure)
- [ ] Test quick actions
- [ ] Verify all 16 operations show notifications

**Components Page:**
- [ ] Test bulk actions (Start All, Stop All, etc.)
- [ ] Test individual component operations
- [ ] Verify search and filter work
- [ ] Verify all 22 operations show notifications

**Component Showcase:**
- [ ] Test all demo components
- [ ] Verify 23 operations work
- [ ] This is a demo page, can be optional

**Features Page:**
- [ ] Test feature toggles
- [ ] Test service controls
- [ ] Test bulk enable/disable
- [ ] Verify ~20 operations work

### Browser Console Testing

- [ ] Open browser console
- [ ] Type: `window.__TEST_HELPER__.notify.success("Test")`
- [ ] Verify notification appears
- [ ] Test all 4 notification types via console
- [ ] Test `window.__TEST_HELPER__.clickByText("Optimize")`

## Post-Integration

### Code Review

- [ ] Review all modified files
- [ ] Check for any merge conflicts
- [ ] Verify code style consistency
- [ ] Run linter if available

### Documentation

- [ ] Update project README with notification system info
- [ ] Document any customizations made
- [ ] Add testing instructions to project docs

### Cleanup

- [ ] Remove test pages if not needed
- [ ] Remove unused imports
- [ ] Clean up console.log statements
- [ ] Optimize bundle size if needed

## Remaining Work

The following pages still need notification integration:

### AdaptersPage.tsx

- [ ] Import useNotification hook
- [ ] Update handleConnect with notifications
- [ ] Update handleDisconnect with notifications
- [ ] Update handleConfigure with notifications
- [ ] Update handleTest with notifications
- [ ] Test all operations

### MonitoringPage.tsx

- [ ] Import useNotification hook
- [ ] Update refresh handlers with notifications
- [ ] Update export handlers with notifications
- [ ] Test all operations

### SettingsPage.tsx

- [ ] Import useNotification hook
- [ ] Update save handlers with notifications
- [ ] Update reset handlers with notifications
- [ ] Update import/export handlers with notifications
- [ ] Test all operations

## API Integration

After UI integration is complete:

- [ ] Replace mock operations with real API calls
- [ ] Add proper error handling
- [ ] Add loading states
- [ ] Add confirmation dialogs for destructive operations
- [ ] Test with real backend

## Performance Optimization

- [ ] Profile notification rendering performance
- [ ] Optimize re-renders if needed
- [ ] Consider lazy loading for large pages
- [ ] Optimize bundle splitting

## Production Checklist

- [ ] Remove test pages
- [ ] Remove test helper in production build
- [ ] Verify source maps are not exposed
- [ ] Test production build
- [ ] Test on all target browsers
- [ ] Test on mobile devices
- [ ] Performance audit
- [ ] Security audit

## Rollback Plan

If integration fails:

1. [ ] Checkout previous git branch
2. [ ] Document issues encountered
3. [ ] Review error logs
4. [ ] Seek help or debug incrementally

## Success Criteria

Integration is successful when:

- [ ] All pages load without errors
- [ ] All operations show appropriate notifications
- [ ] Notifications auto-dismiss correctly
- [ ] No console errors
- [ ] Build completes successfully
- [ ] All tests pass
- [ ] User experience is smooth

## Notes

- Take your time with each step
- Test incrementally
- Don't skip the testing phase
- Document any issues for future reference

---

**Estimated Integration Time**: 2-4 hours
**Difficulty**: Medium
**Risk Level**: Low (non-breaking changes)

