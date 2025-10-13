"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiServiceBookingService = void 0;
const supabase_1 = require("../infrastructure/supabase");
class MultiServiceBookingService {
    async getServiceRecommendations(contactId, currentServiceId) {
        const recommendations = [];
        const history = await this.getBookingHistory(contactId);
        const followUpRecs = currentServiceId
            ? await this.getFollowUpRecommendations(currentServiceId)
            : [];
        const serviceIdsForCombos = currentServiceId
            ? [...new Set([...history.serviceIds, currentServiceId])]
            : history.serviceIds;
        const popularCombos = await this.getPopularCombinations(serviceIdsForCombos);
        recommendations.push(...followUpRecs);
        recommendations.push(...popularCombos);
        const historyRecs = await this.getHistoryBasedRecommendations(contactId);
        recommendations.push(...historyRecs);
        const uniqueRecs = this.deduplicateRecommendations(recommendations);
        return uniqueRecs.sort((a, b) => b.priority - a.priority).slice(0, 5);
    }
    async getBookingHistory(contactId) {
        const { data: bookings, error } = await supabase_1.supabase
            .from('bookings')
            .select('service_id, created_at')
            .eq('contact_id', contactId)
            .in('status', ['confirmed', 'cancelled'])
            .order('created_at', { ascending: false });
        if (error || !bookings || bookings.length === 0) {
            return {
                totalBookings: 0,
                serviceIds: [],
                mostFrequentService: '',
                averageBookingsPerMonth: 0,
            };
        }
        const serviceIds = bookings.map(b => b.service_id).filter(Boolean);
        const serviceCounts = serviceIds.reduce((acc, id) => {
            acc[id] = (acc[id] || 0) + 1;
            return acc;
        }, {});
        const mostFrequent = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1])[0];
        const oldestBooking = new Date(bookings[bookings.length - 1].created_at);
        const monthsSinceFirst = (Date.now() - oldestBooking.getTime()) / (1000 * 60 * 60 * 24 * 30);
        const avgPerMonth = monthsSinceFirst > 0 ? bookings.length / monthsSinceFirst : 0;
        return {
            totalBookings: bookings.length,
            serviceIds: [...new Set(serviceIds)],
            mostFrequentService: mostFrequent?.[0] || '',
            lastServiceId: bookings[0]?.service_id,
            averageBookingsPerMonth: avgPerMonth,
        };
    }
    async getFollowUpRecommendations(serviceId) {
        const { data: followUpRules, error } = await supabase_1.supabase
            .from('service_follow_up_rules')
            .select(`
        follow_up_service_id,
        sequence_number,
        days_after,
        is_required,
        reminder_message,
        services:follow_up_service_id (
          name,
          duration_minutes,
          cost
        )
      `)
            .eq('service_id', serviceId)
            .eq('auto_book', false)
            .order('sequence_number', { ascending: true });
        if (error || !followUpRules) {
            return [];
        }
        return followUpRules.map((rule, index) => {
            const service = Array.isArray(rule.services) ? rule.services[0] : rule.services;
            return {
                serviceId: rule.follow_up_service_id,
                serviceName: service?.name || 'Follow-up Service',
                reason: rule.reminder_message || `Recommended follow-up after ${rule.days_after} days`,
                priority: 100 - (index * 10) + (rule.is_required ? 50 : 0),
                estimatedDuration: service?.duration_minutes || 30,
                cost: parseFloat(service?.cost || '0'),
            };
        });
    }
    async getPopularCombinations(customerServiceIds) {
        if (customerServiceIds.length === 0) {
            return [];
        }
        const { data: allBookings, error } = await supabase_1.supabase
            .from('bookings')
            .select('service_id, contact_id')
            .in('status', ['confirmed', 'cancelled'])
            .not('service_id', 'is', null);
        if (error || !allBookings) {
            return [];
        }
        const contactServiceMap = new Map();
        const contactsWithCustomerServices = new Set();
        for (const booking of allBookings) {
            if (!contactServiceMap.has(booking.contact_id)) {
                contactServiceMap.set(booking.contact_id, new Set());
            }
            contactServiceMap.get(booking.contact_id).add(booking.service_id);
            if (customerServiceIds.includes(booking.service_id)) {
                contactsWithCustomerServices.add(booking.contact_id);
            }
        }
        const complementaryCounts = new Map();
        for (const contactId of contactsWithCustomerServices) {
            const services = Array.from(contactServiceMap.get(contactId) || []);
            for (const serviceId of services) {
                if (!customerServiceIds.includes(serviceId)) {
                    complementaryCounts.set(serviceId, (complementaryCounts.get(serviceId) || 0) + 1);
                }
            }
        }
        const topComplementary = Array.from(complementaryCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([serviceId]) => serviceId);
        if (topComplementary.length === 0) {
            return [];
        }
        const { data: services, error: serviceError } = await supabase_1.supabase
            .from('services')
            .select('id, name, duration_minutes, cost')
            .in('id', topComplementary)
            .eq('is_active', true);
        if (serviceError || !services) {
            return [];
        }
        return services.map((service, index) => ({
            serviceId: service.id,
            serviceName: service.name,
            reason: 'Often booked together by customers with similar preferences',
            priority: 70 - (index * 10),
            estimatedDuration: service.duration_minutes,
            cost: parseFloat(service.cost),
        }));
    }
    async getHistoryBasedRecommendations(contactId) {
        const history = await this.getBookingHistory(contactId);
        if (history.totalBookings === 0) {
            return this.getNewCustomerRecommendations();
        }
        let servicesQuery = supabase_1.supabase
            .from('services')
            .select('id, name, duration_minutes, cost, category')
            .eq('is_active', true);
        if (history.serviceIds.length > 0) {
            servicesQuery = servicesQuery.not('id', 'in', `(${history.serviceIds.map(id => `'${id}'`).join(',')})`);
        }
        const { data: services, error } = await servicesQuery;
        if (error || !services) {
            return [];
        }
        const { data: pastServices } = await supabase_1.supabase
            .from('services')
            .select('category')
            .in('id', history.serviceIds);
        const pastCategories = new Set(pastServices?.map(s => s.category).filter(Boolean) || []);
        return services
            .filter(service => service.category && pastCategories.has(service.category))
            .slice(0, 2)
            .map((service, index) => ({
            serviceId: service.id,
            serviceName: service.name,
            reason: `Based on your interest in ${service.category} services`,
            priority: 50 - (index * 10),
            estimatedDuration: service.duration_minutes,
            cost: parseFloat(service.cost),
        }));
    }
    async getNewCustomerRecommendations() {
        const { data: popularServices, error } = await supabase_1.supabase
            .from('bookings')
            .select('service_id')
            .in('status', ['confirmed', 'cancelled']);
        if (error || !popularServices) {
            const { data: defaultServices } = await supabase_1.supabase
                .from('services')
                .select('id, name, duration_minutes, cost')
                .eq('is_active', true)
                .order('cost', { ascending: true })
                .limit(3);
            return (defaultServices || []).map((service, index) => ({
                serviceId: service.id,
                serviceName: service.name,
                reason: 'Popular introductory service',
                priority: 40 - (index * 10),
                estimatedDuration: service.duration_minutes,
                cost: parseFloat(service.cost),
            }));
        }
        const serviceCounts = popularServices.reduce((acc, b) => {
            acc[b.service_id] = (acc[b.service_id] || 0) + 1;
            return acc;
        }, {});
        const topServiceIds = Object.entries(serviceCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([id]) => id);
        const { data: services } = await supabase_1.supabase
            .from('services')
            .select('id, name, duration_minutes, cost')
            .in('id', topServiceIds);
        return (services || []).map((service, index) => ({
            serviceId: service.id,
            serviceName: service.name,
            reason: 'Popular among new customers',
            priority: 40 - (index * 10),
            estimatedDuration: service.duration_minutes,
            cost: parseFloat(service.cost),
        }));
    }
    deduplicateRecommendations(recommendations) {
        const seen = new Map();
        for (const rec of recommendations) {
            const existing = seen.get(rec.serviceId);
            if (!existing || rec.priority > existing.priority) {
                seen.set(rec.serviceId, rec);
            }
        }
        return Array.from(seen.values());
    }
    async formatRecommendationsMessage(recommendations) {
        if (recommendations.length === 0) {
            return '';
        }
        let message = '\n\n✨ *Recommended Services:*\n';
        recommendations.forEach((rec, index) => {
            message += `\n${index + 1}. *${rec.serviceName}* (${rec.estimatedDuration} min, €${rec.cost.toFixed(2)})`;
            message += `\n   ${rec.reason}`;
        });
        message += '\n\nWould you like to add any of these services to your booking?';
        return message;
    }
    async calculateMultiServiceSchedule(serviceIds, startDate) {
        const { data: services, error } = await supabase_1.supabase
            .from('services')
            .select('id, duration_minutes, cost, buffer_time_after')
            .in('id', serviceIds);
        if (error || !services) {
            throw new Error('Failed to fetch service details');
        }
        const schedule = [];
        let currentTime = new Date(startDate);
        let totalCost = 0;
        let totalDuration = 0;
        for (const serviceId of serviceIds) {
            const service = services.find(s => s.id === serviceId);
            if (!service)
                continue;
            const startTime = new Date(currentTime);
            const endTime = new Date(currentTime);
            endTime.setMinutes(endTime.getMinutes() + service.duration_minutes);
            schedule.push({
                serviceId: service.id,
                startTime,
                endTime,
            });
            totalCost += parseFloat(service.cost);
            totalDuration += service.duration_minutes;
            currentTime = new Date(endTime);
            if (service.buffer_time_after) {
                currentTime.setMinutes(currentTime.getMinutes() + service.buffer_time_after);
                totalDuration += service.buffer_time_after;
            }
        }
        return {
            totalDuration,
            totalCost,
            endDate: currentTime,
            schedule,
        };
    }
}
exports.MultiServiceBookingService = MultiServiceBookingService;
