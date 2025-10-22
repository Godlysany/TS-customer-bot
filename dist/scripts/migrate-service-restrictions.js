"use strict";
/**
 * Migration Script: service_time_restrictions → service_booking_windows
 *
 * This script migrates legacy JSONB service_time_restrictions data
 * to the new normalized service_booking_windows table.
 *
 * Run once during deployment:
 * npx tsx src/scripts/migrate-service-restrictions.ts
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_1 = require("../infrastructure/supabase");
const ServiceAvailabilityService_1 = __importDefault(require("../core/ServiceAvailabilityService"));
const DAY_MAP = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
};
async function migrateServiceRestrictions() {
    console.log('🔄 Starting migration: service_time_restrictions → service_booking_windows');
    try {
        // Fetch all services with booking_time_restrictions
        const { data: services, error } = await supabase_1.supabase
            .from('services')
            .select('id, name, booking_time_restrictions')
            .not('booking_time_restrictions', 'is', null);
        if (error) {
            console.error('❌ Error fetching services:', error);
            return;
        }
        if (!services || services.length === 0) {
            console.log('✅ No services with booking_time_restrictions found. Migration not needed.');
            return;
        }
        console.log(`📋 Found ${services.length} services with time restrictions`);
        let totalWindows = 0;
        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;
        for (const service of services) {
            try {
                console.log(`\n🔍 Processing service: ${service.name} (${service.id})`);
                const restrictions = service.booking_time_restrictions;
                if (!restrictions || (typeof restrictions !== 'object')) {
                    console.log(`   ⏭️  Skipping - invalid restrictions format`);
                    skipCount++;
                    continue;
                }
                const windows = [];
                // Case 1: specificWindows (most detailed)
                if (restrictions.specificWindows && Array.isArray(restrictions.specificWindows)) {
                    console.log(`   📅 Found ${restrictions.specificWindows.length} specific windows`);
                    for (const window of restrictions.specificWindows) {
                        const dayOfWeek = DAY_MAP[window.day.toLowerCase()];
                        if (dayOfWeek === undefined) {
                            console.log(`   ⚠️  Unknown day: ${window.day}, skipping`);
                            continue;
                        }
                        windows.push({
                            serviceId: service.id,
                            dayOfWeek,
                            startTime: window.start,
                            endTime: window.end,
                            isActive: true,
                        });
                    }
                }
                // Case 2: days + hours (apply same hours to all days)
                else if (restrictions.days && restrictions.hours) {
                    console.log(`   📅 Found ${restrictions.days.length} days with hours: ${restrictions.hours}`);
                    const [startTime, endTime] = restrictions.hours.split('-');
                    for (const day of restrictions.days) {
                        const dayOfWeek = DAY_MAP[day.toLowerCase()];
                        if (dayOfWeek === undefined) {
                            console.log(`   ⚠️  Unknown day: ${day}, skipping`);
                            continue;
                        }
                        windows.push({
                            serviceId: service.id,
                            dayOfWeek,
                            startTime: startTime.trim(),
                            endTime: endTime.trim(),
                            isActive: true,
                        });
                    }
                }
                else {
                    console.log(`   ⏭️  Skipping - no recognizable restriction pattern`);
                    skipCount++;
                    continue;
                }
                if (windows.length === 0) {
                    console.log(`   ⏭️  No valid windows to migrate`);
                    skipCount++;
                    continue;
                }
                // Insert windows into database
                console.log(`   💾 Inserting ${windows.length} booking windows...`);
                await ServiceAvailabilityService_1.default.replaceBookingWindows(service.id, windows);
                totalWindows += windows.length;
                successCount++;
                console.log(`   ✅ Successfully migrated ${windows.length} windows`);
            }
            catch (serviceError) {
                console.error(`   ❌ Error processing service ${service.name}:`, serviceError.message);
                errorCount++;
            }
        }
        console.log('\n' + '='.repeat(60));
        console.log('📊 Migration Summary');
        console.log('='.repeat(60));
        console.log(`✅ Successfully migrated: ${successCount} services`);
        console.log(`⏭️  Skipped: ${skipCount} services`);
        console.log(`❌ Errors: ${errorCount} services`);
        console.log(`📅 Total booking windows created: ${totalWindows}`);
        console.log('='.repeat(60));
        if (successCount > 0) {
            console.log('\n✨ Migration completed successfully!');
            console.log('💡 Next steps:');
            console.log('   1. Verify booking windows in the database');
            console.log('   2. Test booking flow with new windows');
            console.log('   3. Consider removing legacy booking_time_restrictions column');
        }
    }
    catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    }
}
// Run migration
if (require.main === module) {
    migrateServiceRestrictions()
        .then(() => {
        console.log('\n🎉 Migration script finished');
        process.exit(0);
    })
        .catch((error) => {
        console.error('\n💥 Migration script failed:', error);
        process.exit(1);
    });
}
exports.default = migrateServiceRestrictions;
